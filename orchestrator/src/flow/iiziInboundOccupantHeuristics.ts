/**
 * Deterministic transcript hints for IIZI combined inbound occupant / tow heuristics.
 * Shared by `media-stream.ts` (runtime) and smoke tests — keep lists in one place.
 */

/** Substrings that imply tow / transport escalation (log + occupant path alignment). */
export const IIZI_TOW_TRANSPORT_FLOW_KEYWORDS = [
  "puksiir",
  "pukseerimine",
  "tow",
  "towing",
  "эвакуатор",
  "evakuaator",
] as const;

/** Same list previously inline in media-stream — transcript may require occupant count later in pipeline. */
export const IIZI_ROADSIDE_OCCUPANT_KEYWORDS = [
  "avarii",
  "õnnetus",
  "kokkupõrge",
  "accident",
  "crash",
  "puksiir",
  "pukseerimine",
  "tow",
  "towing",
  "auto ei käivitu",
  "ei käivitu",
  "auto ei liigu",
  "sõiduk ei liigu",
  "auto on kinni",
  "kinni",
  "stuck",
  "stranded",
  "cannot move",
  "does not move",
  "won't start",
] as const;

export const IIZI_PASSENGER_OCCUPANT_KEYWORDS = [
  "girlfriend",
  "boyfriend",
  "wife",
  "husband",
  "friend",
  "child",
  "passenger",
  "kaasreisija",
  "reisija",
  "tüdruk",
  "naine",
  "mees",
  "sõber",
  "laps",
] as const;

export function iiziTowTransportFlowHint(callerSpeechLower: string): string | null {
  for (const kw of IIZI_TOW_TRANSPORT_FLOW_KEYWORDS) {
    if (callerSpeechLower.includes(kw)) return kw;
  }
  return null;
}

export function iiziMatchedRoadsideOccupantKeyword(callerSpeechLower: string): string | null {
  for (const kw of IIZI_ROADSIDE_OCCUPANT_KEYWORDS) {
    if (callerSpeechLower.includes(kw)) return kw;
  }
  return null;
}

export function iiziMatchedPassengerOccupantKeyword(callerSpeechLower: string): string | null {
  for (const kw of IIZI_PASSENGER_OCCUPANT_KEYWORDS) {
    if (callerSpeechLower.includes(kw)) return kw;
  }
  return null;
}

/**
 * True when speech looks like fuel / battery / tyre / empty-tank style roadside
 * without any of the tow/stranded/won't-start occupant heuristics.
 */
export function iiziFuelBatteryTyreOnlyRoadsideIssue(callerSpeechLower: string): boolean {
  const hasFuelBatTyre = /(diisel|bensiin|diesel|kütus|aku|rehv|battery|fuel|tank|otsas|tühi)/i.test(
    callerSpeechLower,
  );
  if (!hasFuelBatTyre) return false;
  return iiziMatchedRoadsideOccupantKeyword(callerSpeechLower) === null;
}
