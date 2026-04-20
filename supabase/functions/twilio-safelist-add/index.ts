// One-time admin utility to add a phone number to Twilio's Global Safe List.
// This is NOT part of the normal SMS send flow.
// Safe-listing is account-level and should be run ONCE per test number to
// avoid Twilio false-positive 30453 blocking during testing.
//
// Usage:
//   POST /functions/v1/twilio-safelist-add
//   Body: { "phoneNumber": "+37253402318" }
//
// Reference: https://www.twilio.com/docs/messaging/api/safelist-resource

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phoneNumber } = await req.json().catch(() => ({}));
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing 'phoneNumber' (E.164, e.g. +37253402318)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const tok = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !tok) {
      return new Response(
        JSON.stringify({ ok: false, error: "Twilio credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const auth = btoa(`${sid}:${tok}`);
    const res = await fetch("https://accounts.twilio.com/v1/SafeList/Numbers", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ PhoneNumber: phoneNumber }).toString(),
    });

    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // keep as text
    }

    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, twilio: data }, null, 2),
      {
        status: res.ok ? 200 : res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
