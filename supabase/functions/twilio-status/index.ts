import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${correlationId}] POST /twilio-status`);

  try {
    // Check if this is a config check request
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await req.json();
      
      if (body.action === 'check_config') {
        const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER');
        
        return new Response(
          JSON.stringify({
            configured: !!(twilioAccountSid && twilioAuthToken && twilioFromNumber),
            correlation_id: correlationId
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Parse form data from Twilio status callback
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    formData.forEach((value, key) => {
      payload[key] = value.toString();
    });

    console.log(`[${correlationId}] Twilio status callback:`, {
      CallSid: payload.CallSid,
      CallStatus: payload.CallStatus,
      CallDuration: payload.CallDuration,
      From: payload.From,
      To: payload.To
    });

    // Generate idempotency key
    const idempotencyKey = `twilio:status:${payload.CallSid}:${payload.CallStatus}:${payload.Timestamp || Date.now()}`;
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check idempotency
    const { data: existingKey } = await supabase
      .from('idempotency_keys')
      .select('key')
      .eq('key', idempotencyKey)
      .maybeSingle();

    if (existingKey) {
      console.log(`[${correlationId}] Duplicate webhook, already processed: ${idempotencyKey}`);
      return new Response(
        JSON.stringify({ ok: true, duplicate: true, correlation_id: correlationId }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Insert idempotency key
    await supabase.from('idempotency_keys').insert({
      key: idempotencyKey,
      namespace: 'twilio_status',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // TODO: Update call record in database when calls table exists
    // For now, just log the event
    console.log(`[${correlationId}] Processed status update for ${payload.CallSid}: ${payload.CallStatus}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        processed: true,
        call_sid: payload.CallSid,
        status: payload.CallStatus,
        correlation_id: correlationId 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        correlation_id: correlationId 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
