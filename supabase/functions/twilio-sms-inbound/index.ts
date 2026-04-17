import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWIML_EMPTY = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twimlResponse(status = 200) {
  return new Response(TWIML_EMPTY, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Twilio sends application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let to = "";
    let body = "";
    let messageSid = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      from = params.get("From") || "";
      to = params.get("To") || "";
      body = params.get("Body") || "";
      messageSid = params.get("MessageSid") || params.get("SmsSid") || "";
    } else {
      const json = await req.json().catch(() => ({}));
      from = json.From || json.from || "";
      to = json.To || json.to || "";
      body = json.Body || json.body || "";
      messageSid = json.MessageSid || json.SmsSid || "";
    }

    if (!from || !body) {
      console.warn(`[twilio-sms-inbound] Missing From/Body`, { from, to, body });
      return twimlResponse(200);
    }

    console.log(`[twilio-sms-inbound] Received SMS from ${from} to ${to}: "${body.slice(0, 80)}" sid=${messageSid}`);

    // Find the most recent active call from this number (within last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentCall, error: callErr } = await supabase
      .from("calls")
      .select("id, agent_id")
      .eq("from_number", from)
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (callErr) {
      console.error(`[twilio-sms-inbound] Call lookup error:`, callErr);
    }

    const callId = recentCall?.id || null;
    const agentId = recentCall?.agent_id || null;

    if (callId) {
      console.log(`[twilio-sms-inbound] Linked SMS to active call ${callId}`);
    } else {
      console.log(`[twilio-sms-inbound] No active call found for ${from} (saved unlinked)`);
    }

    const { error: insertErr } = await supabase.from("sms_messages").insert({
      call_id: callId,
      agent_id: agentId,
      direction: "inbound",
      from_number: from,
      to_number: to,
      body,
      twilio_sid: messageSid || null,
      status: "received",
    });

    if (insertErr) {
      console.error(`[twilio-sms-inbound] Insert error:`, insertErr);
    }

    return twimlResponse(200);
  } catch (err) {
    console.error(`[twilio-sms-inbound] Fatal error:`, err);
    return twimlResponse(200); // Always 200 to Twilio to avoid retries
  }
});
