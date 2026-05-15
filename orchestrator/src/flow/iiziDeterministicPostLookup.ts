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
  const insurer = String(opts.vehicle?.insurer ?? "").trim();
  const coverType = String(opts.vehicle?.cover_type ?? "").trim();
  const coverStatus = String(opts.vehicle?.cover_status ?? "").trim();

  const vehicleDesc = [make, model, year].filter(Boolean).join(" ").trim();
  const insParts = [insurer, coverType, coverStatus].filter(Boolean);
  const insTail = insParts.length > 0 ? insParts.join(", ") : "";

  if (vehicleDesc) {
    let line = `Leidsin sõiduki: ${vehicleDesc}`;
    if (insTail) line += `. Kindlustus: ${insTail}`;
    else line += ", kindlustus on aktiivne";
    line += `. Asukoht on ${addr}.`;
    return line;
  }
  return `Leidsin sõiduki andmed ja kindlustus on aktiivne. Asukoht on ${addr}.`;
}

export function iiziDeterministicOccupantQuestionEt(): string {
  return IIZI_OCCUPANT_COUNT_QUESTION_ET;
}

export function iiziDeterministicSameCallbackLineEt(): string {
  return IIZI_DEFAULT_SAME_CALLBACK_LINE_ET;
}
