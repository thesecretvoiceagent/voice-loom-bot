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

  console.log(`[${correlationId}] POST /openai-realtime-status`);

  try {
    const body = await req.json();
    
    if (body.action === 'check_config') {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      
      return new Response(
        JSON.stringify({
          configured: !!openaiApiKey,
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
          correlation_id: correlationId
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Unknown action',
        correlation_id: correlationId
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({
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
