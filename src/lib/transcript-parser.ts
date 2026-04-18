/**
 * Parses a raw call transcript string into structured turn objects.
 *
 * Supports the orchestrator's bracket format:
 *   [Agent]: text
 *   [User]: text
 *   [System]: text
 *
 * Also handles bracket-less variants (Agent: text, User: text, etc.)
 * and common speaker name aliases.
 */

export type TranscriptSpeaker = "agent" | "user" | "system";

export interface TranscriptTurn {
  speaker: TranscriptSpeaker;
  text: string;
}

export function parseTranscript(raw?: string | null): TranscriptTurn[] {
  if (!raw) return [];

  // Try JSON array first (legacy / alternative format)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as TranscriptTurn[];
  } catch {
    // Not JSON — fall through to line-based parsing
  }

  const lines = raw.split("\n").filter((l) => l.trim());

  return lines.map((line): TranscriptTurn => {
    // Agent aliases: AI, Agent, Bot, Assistant — with or without brackets
    const agentMatch = line.match(/^\[?(AI|Agent|Bot|Assistant)\]?:\s*(.+)/i);
    if (agentMatch) return { speaker: "agent", text: agentMatch[2] };

    // User aliases: User, Customer, Caller, Human — with or without brackets
    const userMatch = line.match(/^\[?(User|Customer|Caller|Human)\]?:\s*(.+)/i);
    if (userMatch) return { speaker: "user", text: userMatch[2] };

    // System messages — with or without brackets
    const systemMatch = line.match(/^\[?System\]?:\s*(.+)/i);
    if (systemMatch) return { speaker: "system", text: systemMatch[1] };

    // Unrecognised lines fall back to user
    return { speaker: "user", text: line };
  });
}
