import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  provider: string;
  component: string;
  status: 'healthy' | 'degraded' | 'down' | 'not_configured';
  last_ok_at?: string;
  last_error?: string;
  response_time_ms?: number;
}

serve(async (req) => {
  const correlationId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[${correlationId}] POST /ops-health-run`);

  const results: HealthCheckResult[] = [];
  const now = new Date().toISOString();

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // 1. Check Supabase Database
  if (supabaseUrl && supabaseServiceKey) {
    const startTime = Date.now();
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error } = await supabase.from('provider_status').select('id').limit(1);
      
      if (error) throw error;
      
      results.push({
        provider: 'supabase',
        component: 'database',
        status: 'healthy',
        last_ok_at: now,
        response_time_ms: Date.now() - startTime
      });
    } catch (error) {
      results.push({
        provider: 'supabase',
        component: 'database',
        status: 'down',
        last_error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      });
    }
  } else {
    results.push({
      provider: 'supabase',
      component: 'database',
      status: 'not_configured',
      last_error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set'
    });
  }

  // 2. Check Twilio
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (twilioAccountSid && twilioAuthToken) {
    const startTime = Date.now();
    try {
      const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}.json`, {
        headers: { 'Authorization': `Basic ${authHeader}` }
      });
      
      if (response.ok) {
        results.push({
          provider: 'twilio',
          component: 'api',
          status: 'healthy',
          last_ok_at: now,
          response_time_ms: Date.now() - startTime
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      results.push({
        provider: 'twilio',
        component: 'api',
        status: 'down',
        last_error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      });
    }
  } else {
    results.push({
      provider: 'twilio',
      component: 'api',
      status: 'not_configured',
      last_error: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set'
    });
  }

  // 3. Check OpenAI
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  if (openaiApiKey) {
    const startTime = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiApiKey}` }
      });
      
      if (response.ok) {
        results.push({
          provider: 'openai',
          component: 'api',
          status: 'healthy',
          last_ok_at: now,
          response_time_ms: Date.now() - startTime
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      results.push({
        provider: 'openai',
        component: 'api',
        status: 'down',
        last_error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      });
    }
  } else {
    results.push({
      provider: 'openai',
      component: 'api',
      status: 'not_configured',
      last_error: 'OPENAI_API_KEY not set'
    });
  }

  // 4. Check Lovable AI Gateway (always available)
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (lovableApiKey) {
    const startTime = Date.now();
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        })
      });
      
      if (response.ok || response.status === 429) {
        // 429 means rate limited but API is reachable
        results.push({
          provider: 'gemini',
          component: 'api',
          status: response.ok ? 'healthy' : 'degraded',
          last_ok_at: response.ok ? now : undefined,
          last_error: response.status === 429 ? 'Rate limited' : undefined,
          response_time_ms: Date.now() - startTime
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      results.push({
        provider: 'gemini',
        component: 'api',
        status: 'down',
        last_error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime
      });
    }
  } else {
    results.push({
      provider: 'gemini',
      component: 'api',
      status: 'not_configured',
      last_error: 'LOVABLE_API_KEY not set'
    });
  }

  // Update provider_status table
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      for (const result of results) {
        await supabase.from('provider_status').upsert({
          provider: result.provider,
          component: result.component,
          state: result.status === 'healthy' ? 'healthy' : result.status === 'degraded' ? 'degraded' : 'down',
          last_checked_at: now,
          last_success_at: result.last_ok_at,
          last_error: result.last_error,
          updated_at: now
        }, {
          onConflict: 'provider,component'
        });
      }
    } catch (error) {
      console.error(`[${correlationId}] Failed to update provider_status:`, error);
    }
  }

  console.log(`[${correlationId}] Health check complete:`, results.map(r => `${r.provider}/${r.component}: ${r.status}`));

  return new Response(
    JSON.stringify({
      success: true,
      results,
      status: 'completed',
      correlation_id: correlationId
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});
