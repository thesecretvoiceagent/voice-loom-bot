import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StartCallRequest {
  to_number: string;
  agent_id: string;
  campaign_id?: string;
  variables?: Record<string, string>;
  idempotency_key?: string;
}

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${correlationId}] POST /calls-start`);

  // Init Supabase client with service role for DB writes
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      console.log(`[${correlationId}] Twilio not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'not_configured',
          error: 'Twilio is not configured. Required secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER',
          correlation_id: correlationId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: StartCallRequest = await req.json();
    console.log(`[${correlationId}] Request:`, { to_number: body.to_number, agent_id: body.agent_id });

    if (!body.to_number || !body.agent_id) {
      return new Response(
        JSON.stringify({ success: false, status: 'error', error: 'Missing required fields: to_number, agent_id', correlation_id: correlationId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert call record into DB
    const { data: callRecord, error: insertError } = await supabase
      .from('calls')
      .insert({
        to_number: body.to_number,
        from_number: twilioFromNumber,
        agent_id: body.agent_id,
        campaign_id: body.campaign_id || null,
        status: 'initiated',
        direction: 'outbound',
        started_at: new Date().toISOString(),
        metadata: { variables: body.variables || {}, correlation_id: correlationId },
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[${correlationId}] DB insert error:`, insertError);
    }

    const callId = callRecord?.id || crypto.randomUUID();

    // Build webhook URLs
    const publicBaseUrl = Deno.env.get('PUBLIC_BASE_URL') || supabaseUrl;
    const statusCallbackUrl = `${publicBaseUrl}/functions/v1/twilio-status`;
    const voiceUrl = `${publicBaseUrl}/functions/v1/twilio-voice`;

    // Call Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('To', body.to_number);
    formData.append('From', twilioFromNumber);
    formData.append('Url', voiceUrl);
    formData.append('StatusCallback', statusCallbackUrl);
    formData.append('StatusCallbackEvent', 'initiated ringing answered completed');
    formData.append('StatusCallbackMethod', 'POST');

    console.log(`[${correlationId}] Calling Twilio API...`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error(`[${correlationId}] Twilio error:`, twilioData);

      // Update call record as failed
      if (callRecord) {
        await supabase.from('calls').update({ status: 'failed', ended_at: new Date().toISOString() }).eq('id', callId);
        await supabase.from('call_events').insert({ call_id: callId, type: 'failed', payload: { error: twilioData.message, correlation_id: correlationId } });
      }

      return new Response(
        JSON.stringify({ success: false, status: 'error', error: twilioData.message || 'Twilio API error', correlation_id: correlationId }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${correlationId}] Call started: ${twilioData.sid}`);

    // Update call record with Twilio SID
    if (callRecord) {
      await supabase.from('calls').update({ twilio_call_sid: twilioData.sid }).eq('id', callId);
      await supabase.from('call_events').insert({ call_id: callId, type: 'initiated', payload: { twilio_call_sid: twilioData.sid, correlation_id: correlationId } });
    }

    return new Response(
      JSON.stringify({ success: true, status: 'started', call_id: callId, twilio_call_sid: twilioData.sid, correlation_id: correlationId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, status: 'error', error: error instanceof Error ? error.message : 'Unknown error', correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
