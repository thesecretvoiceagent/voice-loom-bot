/**
 * Backend-authored Estonian lines for IIZI combined inbound post–vehicle-lookup flow.
 * OpenAI Realtime is instructed to speak scripted lines (see media-stream response.create).
 */

import { IIZI_DEFAULT_SAME_CALLBACK_LINE_ET, IIZI_OCCUPANT_COUNT_QUESTION_ET } from "./iiziInboundCopy.js";

const ASUKOHAKS_PREFIX = "Asukohaks on ";

/** Verbatim occupant question for scripted post-lookup flow (always asked once). */
export const IIZI_SCRIPTED_OCCUPANT_COUNT_ET = "Mitu inimest on autos koos juhiga?";

/** Ask whether the inbound CLI is acceptable for callback. */
export const IIZI_SCRIPTED_CALLBACK_SAME_ET = "Kas tagasihelistamiseks sobib sama number, millelt helistate?";

/** Closing line before hangup when caller confirms same number. */
export const IIZI_SCRIPTED_FINAL_HANDOFF_ET =
  "Selge. Partner või klienditeenindaja võtab Teiega ühendust umbes 5–10 minuti jooksul. Lõpetan kõne.";

/**
 * Short English lock for Realtime: speak one Estonian line verbatim (vehicle + location allowed).
 */
export function formatIiziScriptedRealtimeTtsInstructionsEn(estonianLine: string): string {
  const s = estonianLine.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return (
    `Speak exactly this Estonian text once, verbatim. ` +
    `Do not add words before or after, do not translate, do not paraphrase, do not call tools.\n\n` +
    `Text:\n"""${s}"""`
  );
}

/** Normalize assistant transcript vs expected scripted line for loose ASR-safe compare. */
export function normalizeIiziScriptedSpeechForCompare(s: string): string {
  return String(s || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/["""„"''`´]/gu, "")
    .replace(/[.!?,:;]+$/gu, "")
    .trim();
}

/**
 * True if the spoken transcript materially matches the scripted Estonian line
 * (substring containment or ordered significant-token coverage for long readbacks).
 */
export function materiallyMatchesIiziScriptedSpeech(expected: string, actual: string): boolean {
  const e = normalizeIiziScriptedSpeechForCompare(expected);
  const a = normalizeIiziScriptedSpeechForCompare(actual);
  if (!e || !a) return false;
  if (a.includes(e)) return true;
  if (e.length >= 24 && a.length >= 12 && e.includes(a)) return true;
  const eWords = e.split(" ").filter((w) => w.length > 1);
  if (eWords.length === 0) return false;
  let searchFrom = 0;
  for (const w of eWords) {
    const pos = a.indexOf(w, searchFrom);
    if (pos === -1) return false;
    searchFrom = pos + w.length;
  }
  return true;
}

/**
 * One natural post-lookup summary line (no registration number aloud).
 */
export function buildIiziScriptedPostLookupReadbackEt(
  vehicle: Record<string, unknown> | null,
  address: string,
): string | null {
  if (!vehicle || !String(address || "").trim()) return null;
  const make = String(vehicle.make ?? "").trim();
  const model = String(vehicle.model ?? "").trim();
  const year = String(vehicle.year_of_built ?? vehicle.year ?? "").trim();
  const parts = [make, model, year].filter(Boolean);
  if (parts.length === 0) return null;
  const vLabel = parts.join(" ");
  const addr = String(address).trim().replace(/\s+/gu, " ");
  return `Leidsin sõiduki: ${vLabel}, kindlustus on aktiivne. Asukohaks on ${addr}.`;
}

/**
 * @deprecated Prefer formatIiziScriptedRealtimeTtsInstructionsEn — kept for callers not yet migrated.
 */
export function formatIiziDeterministicExactSentenceInstructionsEn(exactSentence: string): string {
  return formatIiziScriptedRealtimeTtsInstructionsEn(exactSentence);
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
