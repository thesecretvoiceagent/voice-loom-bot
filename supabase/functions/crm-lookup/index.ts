import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Levenshtein distance (capped, cheap)
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// Whisper STT often confuses similar-looking chars on plates (esp. Estonian).
// Normalize common substitutions before comparing.
function normalizePlate(s: string): string {
  return s
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")  // O ↔ 0
    .replace(/I/g, "1")  // I ↔ 1
    .replace(/L/g, "1")  // L ↔ 1 (sometimes)
    .replace(/B/g, "8")  // B ↔ 8 (rare)
    .replace(/Z/g, "2")  // Z ↔ 2
    .replace(/S/g, "5"); // S ↔ 5 (rare)
}

/**
 * CRM lookup for the inbound insurance bot.
 * Accepts { phone_number }, { reg_no }, and/or { description } (free-text vehicle description).
 * Tries: exact phone → exact reg → fuzzy reg (lev≤1 + char-substitution) → description fields.
 * Returns { vehicle: row | null }.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const phone = (body.phone_number || "").toString().trim();
    const reg = (body.reg_no || "").toString().trim().toUpperCase().replace(/\s+/g, "");
    const desc = (body.description || "").toString().trim();

    const fields = "reg_no,make,model,body_type,year_of_built,color,engine_type,gearbox,drivetrain,phone_number,owner_name,insurer,cover_type,cover_status";

    // 1. Try by phone number (exact match)
    if (phone) {
      const { data } = await supabase
        .from("crm_vehicles")
        .select(fields)
        .eq("phone_number", phone)
        .limit(1)
        .maybeSingle();
      if (data) {
        console.log(`[crm-lookup] Match by phone ${phone} → ${data.reg_no} ${data.owner_name}`);
        return new Response(JSON.stringify({ vehicle: data, matched_by: "phone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Try by registration plate (exact match, then fuzzy)
    if (reg) {
      const { data } = await supabase
        .from("crm_vehicles")
        .select(fields)
        .eq("reg_no", reg)
        .limit(1)
        .maybeSingle();
      if (data) {
        console.log(`[crm-lookup] Match by reg_no ${reg} → ${data.make} ${data.model}`);
        return new Response(JSON.stringify({ vehicle: data, matched_by: "reg_no" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fuzzy: pull all plates and compare with edit distance + normalized form.
      // 65 rows is trivial — fine to scan in-memory.
      const { data: all } = await supabase.from("crm_vehicles").select(fields);
      if (all && all.length) {
        const regNorm = normalizePlate(reg);
        let best: any = null;
        let bestScore = 99;
        for (const row of all) {
          const plate = (row.reg_no || "").toUpperCase();
          if (!plate) continue;
          // Exact normalized match wins immediately
          if (normalizePlate(plate) === regNorm) {
            best = row;
            bestScore = 0;
            break;
          }
          const d = lev(plate, reg);
          if (d < bestScore) { bestScore = d; best = row; }
        }
        if (best && bestScore <= 1) {
          console.log(`[crm-lookup] Fuzzy reg match ${reg} → ${best.reg_no} (dist=${bestScore})`);
          return new Response(JSON.stringify({ vehicle: best, matched_by: "reg_no_fuzzy" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 3. Free-text description match: e.g. "must BMW 535D 2006" or "punane SAAB"
    if (desc) {
      const tokens = desc
        .toUpperCase()
        .split(/[\s,;]+/)
        .map((t) => t.replace(/[^A-Z0-9ÄÖÜÕ]/g, ""))
        .filter((t) => t.length >= 2);
      if (tokens.length) {
        const { data: all } = await supabase.from("crm_vehicles").select(fields);
        if (all && all.length) {
          let best: any = null;
          let bestScore = 0;
          for (const row of all) {
            const hay = [row.make, row.model, row.color, row.body_type, row.year_of_built, row.owner_name]
              .filter(Boolean)
              .join(" ")
              .toUpperCase();
            let score = 0;
            for (const t of tokens) {
              if (hay.includes(t)) score++;
            }
            if (score > bestScore) { bestScore = score; best = row; }
          }
          // Require at least 2 token hits to avoid weak matches
          if (best && bestScore >= 2) {
            console.log(`[crm-lookup] Description match "${desc}" → ${best.reg_no} (hits=${bestScore})`);
            return new Response(JSON.stringify({ vehicle: best, matched_by: "description" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }
    }

    console.log(`[crm-lookup] No match (phone=${phone || "-"}, reg_no=${reg || "-"}, desc=${desc || "-"})`);
    return new Response(JSON.stringify({ vehicle: null, matched_by: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-lookup error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
