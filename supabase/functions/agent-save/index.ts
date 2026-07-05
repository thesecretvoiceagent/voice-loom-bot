import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEMO_OWNER_USER_ID = "00000000-0000-4000-8000-000000000001";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = body?.action as string;
    const id = typeof body?.id === "string" ? body.id : null;
    const payload = body?.payload;

    if (!payload || typeof payload !== "object") {
      return json({ ok: false, error: "missing_payload" }, 400);
    }

    if (action === "insert") {
      const row = {
        ...payload,
        user_id: payload.user_id || DEMO_OWNER_USER_ID,
      };
      const { data, error } = await admin
        .from("agents")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        console.error("[agent-save] insert failed:", error.message);
        return json({ ok: false, error: error.message, details: error.details }, 400);
      }
      return json({ ok: true, id: data.id });
    }

    if (action === "update") {
      if (!id) return json({ ok: false, error: "missing_id" }, 400);
      const { data, error } = await admin
        .from("agents")
        .update(payload)
        .eq("id", id)
        .select("*");
      if (error) {
        console.error("[agent-save] update failed:", error.message);
        return json({ ok: false, error: error.message, details: error.details }, 400);
      }
      if (!data?.length) {
        return json({ ok: false, error: "agent_not_found" }, 404);
      }
      return json({ ok: true, agent: data[0] });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (err) {
    console.error("[agent-save] error:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
