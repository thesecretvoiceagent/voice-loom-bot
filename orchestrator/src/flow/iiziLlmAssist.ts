import { config } from "../config.js";
import type { IiziRoadsideCategory } from "./iiziDeterministicTypes.js";

/**
 * LLM interpretation assist for the deterministic IIZI flow.
 *
 * The bot still speaks ONLY scripted TTS lines — this module never produces
 * speech. It exists purely to help the deterministic FSM make the right
 * decision at the three points where rule-based matching is fragile against
 * garbled speech-to-text (e.g. "reef on tühi" → meant "rehv on tühi" = flat
 * tyre):
 *   1. intent     — roadside vs non-roadside vs unsafe vs unclear (+ category)
 *   2. callback   — caller OK with the same callback number, or a different one
 *   3. occupants  — how many people are in the car
 *
 * Every function is fail-safe: on missing API key, disabled flag, timeout,
 * network error, or unparseable output it returns null, and the caller falls
 * back to the existing deterministic rule-based logic. The LLM result is only
 * ever used by the reducer to break ties the rules could not resolve.
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const ASSIST_TIMEOUT_MS = 2500;

export type IiziAssistIntentValue =
  | "roadside_assistance"
  | "not_roadside_assistance"
  | "unsafe"
  | "unclear";

export type IiziAssistCallbackValue = "same_number" | "different_number" | "unknown";

export interface IiziAssistIntent {
  value: IiziAssistIntentValue;
  category: IiziRoadsideCategory | null;
  confidence: number;
}

export interface IiziAssistCallback {
  value: IiziAssistCallbackValue;
  confidence: number;
}

export interface IiziAssistOccupant {
  value: number | null;
  confidence: number;
}

/** Hints attached to a user_transcript turn for the reducer to consult. */
export interface IiziTranscriptAssist {
  intent?: IiziAssistIntent;
  callback?: IiziAssistCallback;
  occupantCount?: IiziAssistOccupant;
}

const ROADSIDE_CATEGORIES: readonly IiziRoadsideCategory[] = [
  "accident",
  "no_start",
  "flat_tire",
  "tow_needed",
  "stuck",
  "out_of_fuel",
  "locked_out",
  "mechanical_issue",
  "generic_roadside",
];

const clampConfidence = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

/**
 * Low-level JSON chat call. Returns a parsed object or null on any failure.
 * Kept private; all behaviour is fail-safe by design.
 */
const chatJson = async (system: string, user: string): Promise<Record<string, unknown> | null> => {
  if (!config.openai.assistEnabled) return null;
  if (!config.openai.apiKey) return null;
  const clean = (user || "").trim();
  if (!clean) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSIST_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.openai.assistModel,
        temperature: 0,
        max_tokens: 80,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: clean },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const INTENT_SYSTEM = `You interpret transcripts of Estonian roadside-assistance phone calls. The transcript comes from speech-to-text and may be garbled by phonetic errors (for example "reef on tühi" or "reff tühi" means "rehv on tühi" = a flat tyre; "auto ei käivitu" = won't start). Infer the caller's INTENDED meaning, not the literal garbled words.

Classify the caller intent and respond with ONLY a JSON object:
{"intent": "roadside_assistance" | "not_roadside_assistance" | "unsafe" | "unclear", "category": <one of "accident","no_start","flat_tire","tow_needed","stuck","out_of_fuel","locked_out","mechanical_issue","generic_roadside" or null>, "confidence": <0..1>}

Definitions:
- "unsafe": caller mentions a personal injury, fire, or immediate danger to people. category null.
- "roadside_assistance": a vehicle problem on the road (flat tyre, won't start, out of fuel, accident, stuck, needs towing, locked out, mechanical fault). Pick the best "category"; use "generic_roadside" if it is clearly roadside but the specific type is unclear.
- "not_roadside_assistance": clearly unrelated to a vehicle breakdown (e.g. general insurance question, sales, wrong number). category null.
- "unclear": you genuinely cannot tell. category null.
Set confidence honestly (low when the transcript is too garbled or empty).`;

const CALLBACK_SYSTEM = `In an Estonian roadside-assistance call, the assistant just asked the caller whether it is OK to call them back on the SAME phone number they are calling from. The caller's reply transcript may be garbled by speech-to-text.

Classify the reply and respond with ONLY a JSON object:
{"value": "same_number" | "different_number" | "unknown", "confidence": <0..1>}

- "same_number": caller agrees the same number is fine (e.g. "jah", "sama number sobib", "see number sobib").
- "different_number": caller wants to be called on a different number, or starts giving another number, or says the current one is not suitable.
- "unknown": cannot tell (noise, off-topic, "halloo", "ma ei kuulnud").`;

const OCCUPANT_SYSTEM = `In an Estonian roadside-assistance call, the assistant just asked how many people are in the car, including the driver. The caller's reply transcript may be garbled by speech-to-text and the number may be written as a word (e.g. "üks"=1, "kaks"=2, "kolm"=3, "neli"=4, "kahekesi"=2).

Respond with ONLY a JSON object:
{"count": <integer 1..8, or null if not stated/unclear>, "confidence": <0..1>}
Only return a count if the caller actually conveyed a number of people. Greetings or filler like "halloo" → null.`;

/** Interpret caller intent for the issue-classification states. */
export const assistIntent = async (transcript: string): Promise<IiziAssistIntent | null> => {
  const parsed = await chatJson(INTENT_SYSTEM, transcript);
  if (!parsed) return null;
  const value = parsed.intent;
  if (
    value !== "roadside_assistance" &&
    value !== "not_roadside_assistance" &&
    value !== "unsafe" &&
    value !== "unclear"
  ) {
    return null;
  }
  let category: IiziRoadsideCategory | null = null;
  if (value === "roadside_assistance") {
    const cat = parsed.category;
    category = ROADSIDE_CATEGORIES.includes(cat as IiziRoadsideCategory)
      ? (cat as IiziRoadsideCategory)
      : "generic_roadside";
  }
  return { value, category, confidence: clampConfidence(parsed.confidence) };
};

/** Interpret the caller's answer to the "same callback number?" question. */
export const assistCallback = async (transcript: string): Promise<IiziAssistCallback | null> => {
  const parsed = await chatJson(CALLBACK_SYSTEM, transcript);
  if (!parsed) return null;
  const value = parsed.value;
  if (value !== "same_number" && value !== "different_number" && value !== "unknown") {
    return null;
  }
  return { value, confidence: clampConfidence(parsed.confidence) };
};

/** Interpret the caller's answer to the occupant-count question. */
export const assistOccupant = async (transcript: string): Promise<IiziAssistOccupant | null> => {
  const parsed = await chatJson(OCCUPANT_SYSTEM, transcript);
  if (!parsed) return null;
  let count: number | null = null;
  const raw = parsed.count;
  if (raw !== null && raw !== undefined) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 8) count = Math.round(n);
  }
  return { value: count, confidence: clampConfidence(parsed.confidence) };
};
