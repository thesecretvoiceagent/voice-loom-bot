/**
 * Backend-authored Estonian lines for IIZI combined inbound post–vehicle-lookup flow.
 * OpenAI Realtime is instructed to speak these verbatim (see media-stream response.create).
 */

import { IIZI_DEFAULT_SAME_CALLBACK_LINE_ET, IIZI_OCCUPANT_COUNT_QUESTION_ET } from "./iiziInboundCopy.js";

/** Strict English lock so the model cannot paraphrase or add confirmation questions. */
export function formatIiziDeterministicExactSentenceInstructionsEn(exactSentence: string): string {
  const s = exactSentence.trim();
  return (
    `SAY EXACTLY THIS SENTENCE AND NOTHING ELSE. ` +
    `Do not add words before or after. Do not ask questions. Do not translate. Do not paraphrase. Do not call tools.\n\n` +
    `EXACT SENTENCE:\n"""${s}"""`
  );
}

/** Single deterministic location line (SMS-confirmed address only). */
export function buildIiziLocationAddressReadbackLineEt(address: string): string | null {
  const a = String(address || "").trim();
  if (!a) return null;
  return `Asukohaks on ${a}.`;
}

export function iiziDeterministicOccupantQuestionEt(): string {
  return IIZI_OCCUPANT_COUNT_QUESTION_ET;
}

export function iiziDeterministicSameCallbackLineEt(): string {
  return IIZI_DEFAULT_SAME_CALLBACK_LINE_ET;
}

export function extractAddressFromAsukohaksLineEt(line: string): string | null {
  const normalized = String(line || "").trim();
  const match = normalized.match(/asukohaks\s+on\s+(.+?)[.!?]*$/i);
  if (!match?.[1]) return null;

  const address = match[1]
    .replace(/[.!?]+$/g, "")
    .trim();

  return address.length > 0 ? address : null;
}
