import { config } from "./config.js";

/**
 * Fetches agent configuration via the Lovable Cloud edge function.
 * This avoids needing the service_role key on Railway —
 * the edge function has it built in.
 */

interface AgentConfig {
  id: string;
  name: string;
  greeting: string | null;
  system_prompt: string | null;
  analysis_prompt: string | null;
  voice: string | null;
  tools: string[] | null;
  settings: Record<string, unknown> | null;
  schedule: Record<string, unknown> | null;
}

async function callAgentConfigFunction(body: Record<string, unknown>): Promise<AgentConfig | null> {
  if (!config.supabase.url) {
    console.warn("[Supabase] SUPABASE_URL not set, cannot fetch agent config");
    return null;
  }

  const functionUrl = `${config.supabase.url.replace(/\/+$/, "")}/functions/v1/agent-config`;

  try {
    console.log(`[Supabase] Calling agent-config function: ${JSON.stringify(body)}`);

    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.supabase.anonKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Supabase] agent-config function error: HTTP ${res.status} ${text}`);
      return null;
    }

    const data = await res.json();
    return data.agent || null;
  } catch (err) {
    console.error("[Supabase] Error calling agent-config function:", err);
    return null;
  }
}

export async function fetchAgentConfig(agentId: string): Promise<AgentConfig | null> {
  return callAgentConfigFunction({ agent_id: agentId });
}

export async function fetchAgentByPhoneNumber(phoneNumber: string): Promise<AgentConfig | null> {
  return callAgentConfigFunction({ phone_number: phoneNumber });
}

export async function fetchFirstActiveAgent(): Promise<AgentConfig | null> {
  return callAgentConfigFunction({ fallback_first: true });
}
