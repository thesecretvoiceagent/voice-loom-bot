import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${correlationId}] POST /twilio-voice`);
  console.log(`[${correlationId}] Headers:`, Object.fromEntries(
    [...req.headers.entries()].filter(([key]) => !key.toLowerCase().includes('auth'))
  ));

  try {
    // Parse form data from Twilio
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    console.log(`[${correlationId}] Twilio voice webhook:`, {
      CallSid: payload.CallSid,
      CallStatus: payload.CallStatus,
      From: payload.From,
      To: payload.To
    });

    // Check if OpenAI Realtime is configured for voice
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const publicWsBaseUrl = Deno.env.get('PUBLIC_WS_BASE_URL') || Deno.env.get('SUPABASE_URL')?.replace('https://', 'wss://');

    if (!openaiApiKey) {
      // Return simple TwiML that says service is not configured
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This voice service is not yet configured. Please try again later.</Say>
  <Hangup/>
</Response>`;

      console.log(`[${correlationId}] OpenAI not configured, returning fallback TwiML`);
      
      return new Response(twiml, {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        }
      });
    }

    // Build TwiML with bidirectional stream to our WebSocket handler
    const streamUrl = `${publicWsBaseUrl}/functions/v1/twilio-stream`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSid" value="${payload.CallSid}"/>
    </Stream>
  </Connect>
</Response>`;

    console.log(`[${correlationId}] Returning stream TwiML to: ${streamUrl}`);

    return new Response(twiml, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/xml' 
      }
    });

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    
    // Return error TwiML
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/xml' 
      }
    });
  }
});
