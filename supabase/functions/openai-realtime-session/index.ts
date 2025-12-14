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

  console.log(`[${correlationId}] POST /openai-realtime-session`);

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      console.log(`[${correlationId}] OpenAI not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'not_configured',
          error: 'OpenAI is not configured. Add OPENAI_API_KEY to secrets.',
          correlation_id: correlationId
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.json();
    const voice = body.voice || 'alloy';
    const instructions = body.instructions || 'You are a helpful AI assistant.';

    console.log(`[${correlationId}] Creating realtime session with voice: ${voice}`);

    // Create ephemeral session token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice,
        instructions
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${correlationId}] OpenAI error:`, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          status: 'error',
          error: `OpenAI API error: ${response.status}`,
          correlation_id: correlationId
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const sessionData = await response.json();
    console.log(`[${correlationId}] Session created: ${sessionData.id}`);

    return new Response(
      JSON.stringify({
        ...sessionData,
        success: true,
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
        success: false,
        status: 'error',
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
