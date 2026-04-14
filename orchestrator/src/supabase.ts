import { config } from "./config.js";

/**
 * Lightweight Supabase REST client for the orchestrator.
 * We don't pull in @supabase/supabase-js to keep the image small —
 * just use fetch against the PostgREST API.
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

export async function fetchAgentConfig(agentId: string): Promise<AgentConfig | null> {
  if (!config.supabase.isConfigured) {
    console.warn("[Supabase] Not configured, cannot fetch agent");
    return null;
  }

  try {
    const url = `${config.supabase.url}/rest/v1/agents?id=eq.${agentId}&select=id,name,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabase.serviceRoleKey,
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Supabase] Failed to fetch agent ${agentId}: HTTP ${res.status}`);
      return null;
    }

    const rows: AgentConfig[] = await res.json();
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error(`[Supabase] Error fetching agent ${agentId}:`, err);
    return null;
  }
}

/**
 * Look up an agent by the Twilio phone number being called.
 * Used for inbound calls where no agentId is specified.
 */
export async function fetchAgentByPhoneNumber(phoneNumber: string): Promise<AgentConfig | null> {
  if (!config.supabase.isConfigured) {
    console.warn("[Supabase] Not configured, cannot fetch agent by phone");
    return null;
  }

  try {
    const url = `${config.supabase.url}/rest/v1/agents?phone_number=eq.${encodeURIComponent(phoneNumber)}&is_active=eq.true&select=id,name,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabase.serviceRoleKey,
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[Supabase] Failed to fetch agent by phone ${phoneNumber}: HTTP ${res.status}`);
      return null;
    }

    const rows: AgentConfig[] = await res.json();
    return rows.length > 0 ? rows[0] : null;
  } catch (err) {
    console.error(`[Supabase] Error fetching agent by phone ${phoneNumber}:`, err);
    return null;
  }
}

/**
 * Fetch the first active agent (fallback when no agentId or phone match).
 */
export async function fetchFirstActiveAgent(): Promise<AgentConfig | null> {
  if (!config.supabase.isConfigured) return null;

  try {
    const url = `${config.supabase.url}/rest/v1/agents?is_active=eq.true&select=id,name,greeting,system_prompt,analysis_prompt,voice,tools,settings,schedule&order=created_at.asc&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: config.supabase.serviceRoleKey,
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;
    const rows: AgentConfig[] = await res.json();
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}
