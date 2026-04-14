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

const AGENT_SELECT_FIELDS = [
  "id",
  "name",
  "greeting",
  "system_prompt",
  "analysis_prompt",
  "voice",
  "tools",
  "settings",
  "schedule",
].join(",");

function getSupabaseRestBaseUrl() {
  const rawUrl = config.supabase.url.trim();

  if (!rawUrl) {
    return null;
  }

  const normalizedUrl = rawUrl
    .replace(/\/+$/u, "")
    .replace(/\/rest\/v1$/iu, "");

  return `${normalizedUrl}/rest/v1`;
}

async function fetchRows<T>(
  resource: string,
  query: Record<string, string>,
): Promise<T[] | null> {
  const restBaseUrl = getSupabaseRestBaseUrl();

  if (!config.supabase.isConfigured || !restBaseUrl) {
    console.warn(`[Supabase] Not configured, cannot query ${resource}`);
    return null;
  }

  try {
    const url = new URL(`${restBaseUrl}/${resource}`);

    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const res = await fetch(url.toString(), {
      headers: {
        apikey: config.supabase.serviceRoleKey,
        Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(
        `[Supabase] ${resource} query failed: HTTP ${res.status} url=${url.toString()} body=${body}`,
      );
      return null;
    }

    return (await res.json()) as T[];
  } catch (err) {
    console.error(`[Supabase] Error querying ${resource}:`, err);
    return null;
  }
}

export async function fetchAgentConfig(agentId: string): Promise<AgentConfig | null> {
  const rows = await fetchRows<AgentConfig>("agents", {
    id: `eq.${agentId}`,
    select: AGENT_SELECT_FIELDS,
    limit: "1",
  });

  return rows?.[0] ?? null;
}

/**
 * Look up an agent by the Twilio phone number being called.
 * Used for inbound calls where no agentId is specified.
 */
export async function fetchAgentByPhoneNumber(phoneNumber: string): Promise<AgentConfig | null> {
  const rows = await fetchRows<AgentConfig>("agents", {
    phone_number: `eq.${phoneNumber}`,
    is_active: "eq.true",
    select: AGENT_SELECT_FIELDS,
    limit: "1",
  });

  return rows?.[0] ?? null;
}

/**
 * Fetch the first active agent (fallback when no agentId or phone match).
 */
export async function fetchFirstActiveAgent(): Promise<AgentConfig | null> {
  const rows = await fetchRows<AgentConfig>("agents", {
    is_active: "eq.true",
    select: AGENT_SELECT_FIELDS,
    order: "created_at.asc",
    limit: "1",
  });

  return rows?.[0] ?? null;
}
