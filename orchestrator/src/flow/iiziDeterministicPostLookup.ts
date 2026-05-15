/**
 * Backend-authored Estonian lines for IIZI combined inbound post–vehicle-lookup flow.
 * OpenAI Realtime is instructed to speak these verbatim (see media-stream response.create).
 */

import { IIZI_DEFAULT_SAME_CALLBACK_LINE_ET, IIZI_OCCUPANT_COUNT_QUESTION_ET } from "./iiziInboundCopy.js";

const ASUKOHAKS_PREFIX = "Asukohaks on ";

/**
 * Maximal English lock: treat this turn as TTS only — no vehicle, reg, insurance, confirmation, questions.
 */
export function formatIiziDeterministicExactSentenceInstructionsEn(exactSentence: string): string {
  const s = exactSentence.trim();
  return (
    `You are a text-to-speech engine for this single response. ` +
    `Say exactly this Estonian sentence and nothing else. ` +
    `Do not mention vehicle, car, registration number, insurance, correctness, confirmation, or ask any question. ` +
    `Do not add words before or after. Do not translate. Do not paraphrase. Do not call tools.\n\n` +
    `Exact sentence:\n"""${s}"""`
  );
}

/** Single deterministic location line (SMS-confirmed address only). */
export function buildIiziLocationAddressReadbackLineEt(address: string): string | null {
  const a = String(address || "").trim();
  if (!a) return null;
  return `${ASUKOHAKS_PREFIX}${a}.`;
}

/** Core address substring from "Asukohaks on …." for transcript verification. */
export function extractAddressFromAsukohaksLineEt(line: string): string | null {
  const t = String(line || "").trim();
  if (!t.toLowerCase().startsWith(ASUKOHAKS_PREFIX.toLowerCase())) return null;
  const inner = t.slice(ASUKOHAKS_PREFIX.length).replace(/\.\s*$/u, "").trim();
  return inner.length > 0 ? inner : null;
}

export function iiziDeterministicOccupantQuestionEt(): string {
  return IIZI_OCCUPANT_COUNT_QUESTION_ET;
}

export function iiziDeterministicSameCallbackLineEt(): string {
  return IIZI_DEFAULT_SAME_CALLBACK_LINE_ET;
}
