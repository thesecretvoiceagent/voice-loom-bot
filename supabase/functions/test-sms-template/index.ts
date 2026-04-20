import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRONTEND_BASE_URL = "https://voice-loom-bot.lovable.app";

function substituteVars(template: string, caseId: string, locationToken: string): string {
  const locationLink = `${FRONTEND_BASE_URL}/location?caseId=${encodeURIComponent(
    caseId,
  )}&token=${encodeURIComponent(locationToken)}`;
  // Form link reuses the same signed token so FormSubmit treats it as a valid signed link
  const formLink = `${FRONTEND_BASE_URL}/form?caseId=${encodeURIComponent(
    caseId,
  )}&token=${encodeURIComponent(locationToken)}`;

  return template
    .replaceAll("{{location_link}}", locationLink)
    .replaceAll("{{form_link}}", formLink)
    .replaceAll("{{caller_name}}", "Henri-Georg Eiche")
    .replaceAll("{{first_name}}", "Henri-Georg")
    .replaceAll("{{caller_reg_no}}", "484DLC");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, content } = await req.json().catch(() => ({}));

    if (!to || typeof to !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing 'to' phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!content || typeof content !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing SMS 'content'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
    const tokenSecret = Deno.env.get("LOCATION_TOKEN_SECRET") || "";

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ ok: false, error: "Twilio not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate a real signed location link (valid UUID + HMAC token) so /location/confirm accepts it
    const caseId = crypto.randomUUID();
    const locationToken = tokenSecret
      ? createHmac("sha256", tokenSecret).update(caseId).digest("hex")
      : "preview";

    const body = substituteVars(content, caseId, locationToken).slice(0, 1600);

    const auth = btoa(`${accountSid}:${authToken}`);
    // Twilio sometimes false-flags repeated test traffic with error 30453.
    // riskCheck: "disable" is used here to prevent false-positive blocking for this SMS flow.
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: body, RiskCheck: "disable" }).toString(),
      },
    );
    const data = await res.json();

    if (!res.ok || data?.error_code) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data?.message || data?.error_message || `Twilio HTTP ${res.status}`,
          code: data?.code || data?.error_code,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sid: data?.sid,
        status: data?.status,
        to: data?.to,
        from: data?.from,
        bodyPreview: body,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
