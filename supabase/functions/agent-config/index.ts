import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const selectFields = "id,name,type,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule,knowledge_base";

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

    // 2. Try by phone number, filtered by direction/type when provided.
    //    Inbound calls → "inbound" agent. Outbound → "outbound" agent.
    if (phone_number) {
      let query = supabase
        .from("agents")
        .select(selectFields)
        .eq("phone_number", phone_number)
        .eq("is_active", true);
      if (dir) query = query.eq("type", dir);

      const { data } = await query.limit(1).maybeSingle();
      if (data) {
        console.log(`Agent matched phone+type: ${phone_number} type=${dir || "any"} → ${data.name}`);
        return new Response(JSON.stringify({ agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Soft fallback: same phone, any type
      if (dir) {
        const { data: anyData } = await supabase
          .from("agents")
          .select(selectFields)
          .eq("phone_number", phone_number)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (anyData) {
          console.log(`Agent matched phone (no type match): ${phone_number} → ${anyData.name}`);
          return new Response(JSON.stringify({ agent: anyData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      console.log(`Agent not found by phone: ${phone_number} dir=${dir}`);
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
