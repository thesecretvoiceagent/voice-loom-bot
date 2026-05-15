/**
 * Backend-authored Estonian lines for IIZI combined inbound post–vehicle-lookup flow.
 * OpenAI Realtime is instructed to speak these verbatim (see media-stream response.create).
 */

import { IIZI_DEFAULT_SAME_CALLBACK_LINE_ET, IIZI_OCCUPANT_COUNT_QUESTION_ET } from "./iiziInboundCopy.js";

export function formatIiziDeterministicAssistantInstructionsEt(verbatim: string): string {
  const v = verbatim.trim();
  return (
    `Your one and ONLY job for this turn is to read the following OUT LOUD, ` +
    `WORD-FOR-WORD, in Estonian exactly as written. ` +
    `Do NOT translate. Do NOT paraphrase. Do NOT add words before or after. ` +
    `Do NOT ask questions. Do NOT call tools in this turn. ` +
    `\n\nTEXT TO SAY VERBATIM:\n"""\n${v}\n"""`
  );
}

/** Single spoken line: vehicle + insurance summary + address. Never includes registration number. */
export function buildIiziDeterministicVehicleLocationReadbackEt(opts: {
  vehicle: Record<string, unknown> | null;
  address: string;
  coverageInvalid: boolean;
}): string | null {
  if (opts.coverageInvalid) return null;
  const addr = String(opts.address || "").trim();
  if (!addr) return null;

  const make = String(opts.vehicle?.make ?? "").trim();
  const model = String(opts.vehicle?.model ?? "").trim();
  const year = String(opts.vehicle?.year_of_built ?? "").trim();

  const vehicleDesc = [make, model, year].filter(Boolean).join(" ").trim();

  if (vehicleDesc) {
    return `Leidsin sõiduki: ${vehicleDesc}, kindlustus on aktiivne. Asukoht on ${addr}.`;
  }
  return `Leidsin sõiduki andmed, kindlustus on aktiivne. Asukoht on ${addr}.`;
}

export function iiziDeterministicOccupantQuestionEt(): string {
  return IIZI_OCCUPANT_COUNT_QUESTION_ET;
}

export function iiziDeterministicSameCallbackLineEt(): string {
  return IIZI_DEFAULT_SAME_CALLBACK_LINE_ET;
}
