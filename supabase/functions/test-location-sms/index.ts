import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, caseId: providedCaseId } = await req.json().catch(() => ({}));
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER")!;
    const tokenSecret = Deno.env.get("LOCATION_TOKEN_SECRET") || "";

    // Generate a UUID-shaped caseId so the LocationConfirm page accepts it
    const caseId = providedCaseId || crypto.randomUUID();
    const token = tokenSecret
      ? createHmac("sha256", tokenSecret).update(caseId).digest("hex")
      : "preview";

    // Frontend route serves the LocationConfirm page
    const baseUrl = "https://voice-loom-bot.lovable.app";
    const url = `${baseUrl}/location/confirm?caseId=${encodeURIComponent(caseId)}&token=${encodeURIComponent(token)}`;

    const body = `IIZI: kinnita oma asukoht: ${url}`;

    const auth = btoa(`${accountSid}:${authToken}`);
    // Twilio sometimes false-flags repeated test traffic with error 30453.
    // riskCheck: "disable" is used here to prevent false-positive blocking for this SMS flow.
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
        RiskCheck: "disable",
      }).toString(),
    });
    const data = await res.json();

    return new Response(JSON.stringify({
      ok: res.ok,
      status: res.status,
      twilio: {
        sid: data?.sid,
        status: data?.status,
        error_code: data?.error_code,
        error_message: data?.error_message,
        from: data?.from,
        to: data?.to,
      },
      caseId,
      url,
      bodyPreview: body,
    }, null, 2), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
