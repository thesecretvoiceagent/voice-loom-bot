import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * CRM lookup for the inbound insurance bot.
 * Accepts either { phone_number } or { reg_no } (or both — phone tried first).
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

    // 2. Try by registration plate (exact match)
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
    }

    console.log(`[crm-lookup] No match (phone=${phone || "-"}, reg_no=${reg || "-"})`);
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
