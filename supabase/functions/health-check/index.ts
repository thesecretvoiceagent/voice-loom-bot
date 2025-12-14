import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceHealth {
  status: "healthy" | "degraded" | "down" | "unknown";
  message: string;
  lastCheck: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const now = new Date().toISOString();
  const results: Record<string, ServiceHealth> = {};

  // Check Lovable AI Gateway (OpenAI/Gemini)
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (LOVABLE_API_KEY) {
    try {
      // Light ping to verify API key works - using a minimal request
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });

      if (response.ok) {
        results.openai = { status: "healthy", message: "Lovable AI Gateway connected", lastCheck: now };
        results.gemini = { status: "healthy", message: "Gemini via Lovable AI available", lastCheck: now };
      } else if (response.status === 429) {
        results.openai = { status: "degraded", message: "Rate limited", lastCheck: now };
        results.gemini = { status: "degraded", message: "Rate limited", lastCheck: now };
      } else {
        results.openai = { status: "down", message: `Error: ${response.status}`, lastCheck: now };
        results.gemini = { status: "down", message: `Error: ${response.status}`, lastCheck: now };
      }
    } catch (error) {
      console.error("AI Gateway check error:", error);
      results.openai = { status: "down", message: "Connection failed", lastCheck: now };
      results.gemini = { status: "down", message: "Connection failed", lastCheck: now };
    }
  } else {
    results.openai = { status: "unknown", message: "LOVABLE_API_KEY not configured", lastCheck: now };
    results.gemini = { status: "unknown", message: "LOVABLE_API_KEY not configured", lastCheck: now };
  }

  // Check Twilio (if configured)
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          },
        }
      );

      if (twilioResponse.ok) {
        results.twilio = { status: "healthy", message: "Twilio API connected", lastCheck: now };
      } else {
        results.twilio = { status: "down", message: `Error: ${twilioResponse.status}`, lastCheck: now };
      }
    } catch (error) {
      console.error("Twilio check error:", error);
      results.twilio = { status: "down", message: "Connection failed", lastCheck: now };
    }
  } else {
    results.twilio = { status: "unknown", message: "Twilio credentials not configured", lastCheck: now };
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
