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

    const body = await req.json();
    const { action } = body;

    // Helper: resolve a tenant_id from an agent_id (so tenant scoping works
    // automatically for every call written through this function).
    const resolveTenantId = async (agentId: string | null | undefined): Promise<string | null> => {
      if (!agentId) return null;
      const { data: agent } = await supabase
        .from("agents")
        .select("tenant_id")
        .eq("id", agentId)
        .maybeSingle();
      return (agent?.tenant_id as string | null) ?? null;
    };

    // CREATE or UPDATE a call record
    if (action === "upsert_call") {
      const { call_id, data } = body;

      // Auto-fill tenant_id from the agent if not already provided.
      const incoming = { ...(data || {}) } as Record<string, unknown>;
      if (!incoming.tenant_id && incoming.agent_id) {
        const tid = await resolveTenantId(incoming.agent_id as string);
        if (tid) incoming.tenant_id = tid;
      }

      // Check if call exists
      const { data: existing } = await supabase
        .from("calls")
        .select("id, agent_id, tenant_id")
        .eq("id", call_id)
        .maybeSingle();

      if (existing) {
        // Backfill tenant_id on update if the row is missing one.
        if (!incoming.tenant_id && !existing.tenant_id) {
          const agentId = (incoming.agent_id as string) || existing.agent_id;
          const tid = await resolveTenantId(agentId);
          if (tid) incoming.tenant_id = tid;
        }
        const { error } = await supabase
          .from("calls")
          .update(incoming)
          .eq("id", call_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("calls")
          .insert({ id: call_id, ...incoming });
        if (error) throw error;
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE call status/recording/transcript
    if (action === "update_call") {
      const { call_id, data } = body;
      const { error } = await supabase
        .from("calls")
        .update(data)
        .eq("id", call_id);
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE call by Twilio SID (for status callbacks)
    if (action === "update_call_by_sid") {
      const { twilio_call_sid, data } = body;
      
      // Try to find and update by SID
      const { data: existing } = await supabase
        .from("calls")
        .select("id")
        .eq("twilio_call_sid", twilio_call_sid)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("calls")
          .update(data)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        console.log(`No call found for SID ${twilio_call_sid}, skipping`);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE sms_messages by Twilio SID (for SMS status callbacks)
    if (action === "update_sms_by_sid") {
      const { twilio_sid, data } = body;

      const { data: existing } = await supabase
        .from("sms_messages")
        .select("id")
        .eq("twilio_sid", twilio_sid)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("sms_messages")
          .update(data)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        console.log(`No sms_messages row found for SID ${twilio_sid}, skipping`);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // INSERT call event
    if (action === "insert_event") {
      const { call_id, type, payload } = body;
      const { error } = await supabase
        .from("call_events")
        .insert({ call_id, type, payload });
      if (error) throw error;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("call-write error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
