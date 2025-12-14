import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateSecureKey(prefix: string): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type } = await req.json();
    console.log(`Generating ${type} key for user ${user.id}`);

    if (type === "api_key") {
      const newApiKey = generateSecureKey("cap");
      
      // Check if settings exist
      const { data: existing } = await supabaseClient
        .from("organization_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseClient
          .from("organization_settings")
          .update({ api_key: newApiKey, api_key_created_at: new Date().toISOString() })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("organization_settings")
          .insert({ user_id: user.id, api_key: newApiKey, api_key_created_at: new Date().toISOString() });

        if (error) throw error;
      }

      // Log the event
      await supabaseClient.rpc("log_audit_event", {
        _action: "api_key_generated",
        _resource_type: "organization_settings",
        _resource_id: user.id,
        _details: { type: "api_key" },
      });

      console.log("API key generated successfully");
      return new Response(JSON.stringify({ api_key: newApiKey }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "webhook_secret") {
      const newSecret = generateSecureKey("whsec");

      const { data: existing } = await supabaseClient
        .from("organization_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabaseClient
          .from("organization_settings")
          .update({ webhook_secret: newSecret, webhook_secret_created_at: new Date().toISOString() })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("organization_settings")
          .insert({ user_id: user.id, webhook_secret: newSecret, webhook_secret_created_at: new Date().toISOString() });

        if (error) throw error;
      }

      await supabaseClient.rpc("log_audit_event", {
        _action: "webhook_secret_generated",
        _resource_type: "organization_settings",
        _resource_id: user.id,
        _details: { type: "webhook_secret" },
      });

      console.log("Webhook secret generated successfully");
      return new Response(JSON.stringify({ webhook_secret: newSecret }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
