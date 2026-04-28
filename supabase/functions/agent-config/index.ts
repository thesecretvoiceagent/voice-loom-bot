import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strip everything but digits — used to compare phone numbers regardless of
// formatting (e.g. "+372 56101535" vs "+37256101535" vs "37256101535").
const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { agent_id, phone_number, fallback_first, direction } = await req.json();
    const dir: "inbound" | "outbound" | null =
      direction === "inbound" || direction === "outbound" ? direction : null;

    const selectFields = "id,name,type,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule,knowledge_base,phone_number,is_active,created_at";

    // 1. Try by agent ID (explicit ID always wins)
    if (agent_id && agent_id !== "default") {
      const { data, error } = await supabase
        .from("agents")
        .select(selectFields)
        .eq("id", agent_id)
        .maybeSingle();

      if (data) {
        return new Response(JSON.stringify({ agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`Agent not found by ID: ${agent_id}`, error?.message);
    }

    // 2. Match by phone number using digits-only comparison so "+372 56101535"
    //    in DB matches "+37256101535" sent by Twilio.
    if (phone_number) {
      const targetDigits = digits(phone_number);
      const { data: candidates } = await supabase
        .from("agents")
        .select(selectFields)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      const matchingByPhone = (candidates || []).filter(
        (a: any) => digits(a.phone_number) === targetDigits && targetDigits.length > 0
      );

      if (matchingByPhone.length > 0) {
        // Prefer same direction/type when provided, then newest updated agent.
        // This mirrors outbound behavior where the UI passes an explicit current
        // agent_id. Without ordering, inbound calls can bind to an older duplicate
        // active agent on the same Twilio number and run stale voice settings.
        const typed = dir ? matchingByPhone.find((a: any) => a.type === dir) : null;
        const chosen = typed || matchingByPhone[0];
        console.log(
          `Agent matched by phone digits: ${phone_number} (digits=${targetDigits}) type=${dir || "any"} → ${chosen.name}`
        );
        return new Response(JSON.stringify({ agent: chosen }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`Agent not found by phone digits: ${phone_number} (digits=${targetDigits}) dir=${dir}`);
    }

    // 3. Fallback: first active agent — direction-aware when provided.
    if (fallback_first) {
      let query = supabase
        .from("agents")
        .select(selectFields)
        .eq("is_active", true);
      if (dir) query = query.eq("type", dir);
      const { data } = await query
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) {
        return new Response(JSON.stringify({ agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`No active agents found dir=${dir}`);
    }

    return new Response(JSON.stringify({ agent: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("agent-config error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
