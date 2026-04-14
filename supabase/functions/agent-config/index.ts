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

    const { agent_id, phone_number, fallback_first } = await req.json();

    const selectFields = "id,name,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule,knowledge_base";

    // 1. Try by agent ID
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

    // 2. Try by phone number
    if (phone_number) {
      const { data, error } = await supabase
        .from("agents")
        .select(selectFields)
        .eq("phone_number", phone_number)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (data) {
        return new Response(JSON.stringify({ agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`Agent not found by phone: ${phone_number}`, error?.message);
    }

    // 3. Fallback to first active agent
    if (fallback_first) {
      const { data, error } = await supabase
        .from("agents")
        .select(selectFields)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data) {
        return new Response(JSON.stringify({ agent: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("No active agents found", error?.message);
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
