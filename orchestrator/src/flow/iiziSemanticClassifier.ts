/**
 * Compact backend semantic intent classifier for IIZI roadside intake.
 *
 * Architecture role:
 *   - Lives behind the deterministic regex classifier as a *fallback* for cases where
 *     regex returns unknown but a transcript exists.
 *   - Never authorizes tools; returns classification data to {@link resolveFinalIntent} only.
 *   - Receives compact backend context, not the live Realtime voice prompt.
 *   - Strict JSON output, timeout-protected, fail-closed to unknown on any error.
 *   - Test-injectable via {@link setSemanticClassifierForTests} so smoke tests stay offline.
 */

import { config } from "../config.js";

export type SemanticClassifyIntent =
  | "roadside"
  | "non_roadside"
  | "emergency_handoff"
  | "unknown";

export type SemanticTranscriptSourceUsed =
  | "deepgram"
  | "openai_realtime"
  | "both"
  | "none";

export interface SemanticClassifierInput {
  call_direction: "inbound" | "outbound";
  agent_domain: string;
  current_phase: string;
  previous_resolved_intent: string;
  openai_transcript: string;
  deepgram_transcript: string;
  caller_known: boolean;
  last_bot_question: string;
  business_policy_summary: string;
}

export interface SemanticClassifierResult {
  intent: SemanticClassifyIntent;
  confidence: number;
  reason: string;
  normalized_issue: string;
  transcript_source_used: SemanticTranscriptSourceUsed;
}

export type SemanticClassifyFn = (
  input: SemanticClassifierInput,
) => Promise<SemanticClassifierResult>;

const FAIL_CLOSED_DEFAULT: SemanticClassifierResult = {
  intent: "unknown",
  confidence: 0,
  reason: "fail_closed_default",
  normalized_issue: "",
  transcript_source_used: "none",
};

let _overrideClassifier: SemanticClassifyFn | null = null;

/** Test hook: replace the network-backed classifier with a deterministic stub. */
export function setSemanticClassifierForTests(fn: SemanticClassifyFn | null): void {
  _overrideClassifier = fn;
}

/** Public entry — dispatches to override (tests) or live OpenAI implementation. */
export async function classifyIntentSemantic(
  input: SemanticClassifierInput,
): Promise<SemanticClassifierResult> {
  if (_overrideClassifier) {
    try {
      const r = await _overrideClassifier(input);
      return sanitizeResult(r) ?? { ...FAIL_CLOSED_DEFAULT, reason: "override_invalid_result" };
    } catch (err) {
      console.error("[SemanticClassifier] override threw", err);
      return { ...FAIL_CLOSED_DEFAULT, reason: "override_error" };
    }
  }
  return classifyIntentSemanticOpenAI(input);
}

/**
 * Default timeout for the live OpenAI classifier call.
 * Staging recommendation: 3000 ms — gives the model enough budget for ASR-error
 * normalization on first turns without stalling the controlled-response gate too long.
 * Override per-env via OPENAI_SEMANTIC_CLASSIFIER_TIMEOUT_MS.
 */
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Compact backend policy. Intentionally short — represents IIZI business rules
 * as a backend brain policy, NOT pasted into the live voice prompt.
 */
function buildPrompt(input: SemanticClassifierInput): { system: string; user: string } {
  const system =
    `You are a strict intent classifier for an Estonian roadside assistance phone bot (IIZI Kindlustusmaakler).\n` +
    `Decide if the caller currently needs roadside assistance ("autoabi"), based on transcripts that may contain ASR errors.\n\n` +
    `Categories:\n` +
    `- "roadside": caller needs autoabi. Includes fuel-out (any fuel: bensiin/diisel/petrol/D/95/98), dead battery (aku), flat tire (rehv/kumm), lockout (võtmed autos / uks lukus), towing (puksiir/kraav), accident (avarii/õnnetus), stranded car (auto ei käivitu / ei liigu / jäin teele), generator/alternator failure, fluid/oil leak causing car to stop, or any vehicle problem requiring on-road help.\n` +
    `- "non_roadside": office hours, insurance info/sales, billing, contracts/quotes, contact info, general questions, OR explicit denial that autoabi is needed.\n` +
    `- "emergency_handoff": 112, ambulance/kiirabi, police/politsei, fire/tulekahju/põleng, immediate medical danger, life-threatening.\n` +
    `- "unknown": gibberish, greeting only, both transcripts empty, or insufficient signal to decide.\n\n` +
    `Heuristics:\n` +
    `- ASR may misspell phonetically: "tiisel"→diisel, "pentiin"→bensiin, "akuu"→aku, "puksiiri"→puksiir. Map phonetically; do not require exact spelling.\n` +
    `- Estonian, Russian and English transcripts supported.\n` +
    `- If both transcripts present and agree, use "both" as source; otherwise pick the clearer one.\n` +
    `- Prefer the deepgram_transcript when it is non-empty and semantically clear.\n` +
    `- Explicit denial like "ma ei vaja autoabi" / "pole abi vaja" → non_roadside.\n` +
    `- Do not invent facts. If unclear, return "unknown".\n\n` +
    `Output STRICT JSON ONLY, no prose, no markdown, no comments:\n` +
    `{"intent":"roadside|non_roadside|emergency_handoff|unknown","confidence":0..1,"reason":"short","normalized_issue":"short","transcript_source_used":"deepgram|openai_realtime|both|none"}`;

  const user = JSON.stringify({
    call_direction: input.call_direction,
    agent_domain: input.agent_domain,
    current_phase: input.current_phase,
    previous_resolved_intent: input.previous_resolved_intent,
    openai_transcript: input.openai_transcript,
    deepgram_transcript: input.deepgram_transcript,
    caller_known: input.caller_known,
    last_bot_question: input.last_bot_question,
    business_policy_summary: input.business_policy_summary,
  });

  return { system, user };
}

async function classifyIntentSemanticOpenAI(
  input: SemanticClassifierInput,
): Promise<SemanticClassifierResult> {
  const apiKey = config?.openai?.apiKey;
  if (!apiKey) {
    return { ...FAIL_CLOSED_DEFAULT, reason: "no_openai_api_key" };
  }
  const model = process.env.OPENAI_SEMANTIC_CLASSIFIER_MODEL || DEFAULT_MODEL;
  const timeoutMs =
    Number(process.env.OPENAI_SEMANTIC_CLASSIFIER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const { system, user } = buildPrompt(input);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[SemanticClassifier] http_${res.status} model=${model} body="${body.slice(0, 200)}"`,
      );
      return { ...FAIL_CLOSED_DEFAULT, reason: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const content = extractContent(json);
    if (!content) {
      return { ...FAIL_CLOSED_DEFAULT, reason: "empty_content" };
    }
    const parsed = safeParseClassifierJson(content);
    if (!parsed) {
      console.error(
        `[SemanticClassifier] unparseable_json model=${model} content="${content.slice(0, 200)}"`,
      );
      return { ...FAIL_CLOSED_DEFAULT, reason: "unparseable_json" };
    }
    return parsed;
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === "AbortError";
    if (!aborted) {
      console.error(`[SemanticClassifier] fetch_error`, err);
    }
    return { ...FAIL_CLOSED_DEFAULT, reason: aborted ? "timeout" : "fetch_error" };
  } finally {
    clearTimeout(timer);
  }
}

function extractContent(json: unknown): string {
  if (!json || typeof json !== "object") return "";
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as { message?: { content?: unknown } }).message;
  const content = message?.content;
  return typeof content === "string" ? content : "";
}

function sanitizeResult(r: unknown): SemanticClassifierResult | null {
  if (!r || typeof r !== "object") return null;
  const obj = r as Record<string, unknown>;
  const intent = obj.intent;
  if (
    intent !== "roadside" &&
    intent !== "non_roadside" &&
    intent !== "emergency_handoff" &&
    intent !== "unknown"
  ) {
    return null;
  }
  const confRaw = obj.confidence;
  const confidence =
    typeof confRaw === "number" && Number.isFinite(confRaw)
      ? Math.max(0, Math.min(1, confRaw))
      : 0;
  const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 200) : "";
  const normalized_issue =
    typeof obj.normalized_issue === "string" ? obj.normalized_issue.slice(0, 200) : "";
  let transcript_source_used: SemanticTranscriptSourceUsed = "none";
  const srcRaw = obj.transcript_source_used;
  if (
    srcRaw === "deepgram" ||
    srcRaw === "openai_realtime" ||
    srcRaw === "both" ||
    srcRaw === "none"
  ) {
    transcript_source_used = srcRaw;
  }
  return { intent, confidence, reason, normalized_issue, transcript_source_used };
}

function safeParseClassifierJson(raw: string): SemanticClassifierResult | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  return sanitizeResult(obj);
}
