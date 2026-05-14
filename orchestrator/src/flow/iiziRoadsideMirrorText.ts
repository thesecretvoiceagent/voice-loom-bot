/**
 * Backend-owned Estonian copy for IIZI inbound roadside controlled assistant turn
 * (pre–combined-SMS). Never exposes internal semantic slug / English labels to the caller.
 */

import type { IiziBrainRuntimeState } from "./iiziBrain.js";

const MIRROR_ISSUE_MAX_LEN = 96;

export function scrubMirrorFragment(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function clipMirrorFragment(s: string, maxLen: number): string {
  const one = scrubMirrorFragment(s);
  if (one.length <= maxLen) return one;
  return `${one.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`;
}

function normalizeIssueKey(raw: string): string {
  return scrubMirrorFragment(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Snake_case / token-only strings from classifiers — not customer-facing. */
function looksLikeInternalIssueToken(s: string): boolean {
  const t = scrubMirrorFragment(s);
  if (t.length < 2) return false;
  if (/_/u.test(t) && /^[a-z0-9_]+$/i.test(t)) return true;
  if (/^(unknown|roadside|non_roadside|emergency)$/i.test(t)) return true;
  return false;
}

/** Short English issue summaries the semantic layer may emit — map, don't read aloud. */
function looksLikeAsciiEnglishIssueSummary(s: string): boolean {
  const t = scrubMirrorFragment(s).toLowerCase();
  if (!t) return false;
  if (/[äöõüžš]/i.test(s)) return false;
  return /\b(fuel|oil|tire|wheel|battery|lockout|missing|accident|unknown|roadside|flat|dead|tow|stuck)\b/i.test(t);
}

function isPlausibleCallerTranscriptForMirror(t: string): boolean {
  const s = scrubMirrorFragment(t);
  if (s.length < 6) return false;
  if (looksLikeInternalIssueToken(s)) return false;
  if (looksLikeAsciiEnglishIssueSummary(s)) return false;
  if (!/\s/.test(s) && s.length < 14) return false;
  return true;
}

/** Map semantic / internal labels (and common English summaries) → Estonian clause fragment after "Teil …". */
const ISSUE_SLUG_TO_ET: Record<string, string> = {
  fuel_out: "sai kütus otsa",
  fuel: "sai kütus otsa",
  oil_out: "sai õli otsa",
  oil: "sai õli otsa",
  battery: "on aku tühi",
  dead_battery: "on aku tühi",
  wheel_or_tire_came_off: "tuli ratas või rehv alt ära",
  tire_off: "tuli ratas või rehv alt ära",
  wheel_missing: "tuli ratas või rehv alt ära",
  tire_missing: "tuli ratas või rehv alt ära",
  tire_puncture: "on rehviga probleem",
  flat_tire: "on rehviga probleem",
  lockout: "võtmed jäid autosse või uks on lukus",
  lock_out: "võtmed jäid autosse või uks on lukus",
  wheel_came_off: "tuli ratas või rehv alt ära",
  tire_came_off: "tuli ratas või rehv alt ära",
  tow: "auto ei liigu",
  stuck: "auto ei liigu",
  non_movable: "auto ei liigu",
  accident: "juhtus õnnetus",
  unknown: "vajate autoabi",
};

function mapInternalOrEnglishIssueToEstonianClause(raw: string): string | null {
  const key = normalizeIssueKey(raw);
  if (!key) return null;
  if (ISSUE_SLUG_TO_ET[key]) return ISSUE_SLUG_TO_ET[key];
  if (key.includes("tow")) return ISSUE_SLUG_TO_ET.tow;
  if (key.includes("stuck") || key.includes("non_movable")) return ISSUE_SLUG_TO_ET.stuck;
  if (key.includes("accident")) return ISSUE_SLUG_TO_ET.accident;
  return null;
}

/**
 * Core resolution: Estonian fragment after "Sain aru, et Teil …".
 * Prefer caller transcript when it looks like real speech; otherwise map internal labels.
 */
export function resolveIiziRoadsideMirrorIssueClause(
  lastOpenaiIntentTranscriptPreview: string,
  semanticNormalizedIssue: string,
): string {
  const transcript = scrubMirrorFragment(lastOpenaiIntentTranscriptPreview);
  if (isPlausibleCallerTranscriptForMirror(transcript)) {
    return clipMirrorFragment(transcript, MIRROR_ISSUE_MAX_LEN);
  }
  const semanticRaw = scrubMirrorFragment(semanticNormalizedIssue);
  const mapped = mapInternalOrEnglishIssueToEstonianClause(semanticRaw);
  if (mapped) return mapped;
  if (semanticRaw.length >= 3 && !looksLikeInternalIssueToken(semanticRaw) && !looksLikeAsciiEnglishIssueSummary(semanticRaw)) {
    return clipMirrorFragment(semanticRaw, MIRROR_ISSUE_MAX_LEN);
  }
  return "vajate autoabi";
}

export function buildIiziRoadsideMirrorIssueClause(state: IiziBrainRuntimeState): string {
  return resolveIiziRoadsideMirrorIssueClause(
    state.lastOpenaiIntentTranscriptPreview || "",
    state.semanticNormalizedIssue || "",
  );
}

/** Test hook — same logic as {@link buildIiziRoadsideMirrorIssueClause}. */
export function mirrorIssueClauseFromInputs(input: {
  semanticNormalizedIssue?: string;
  lastOpenaiIntentTranscriptPreview?: string;
}): string {
  return resolveIiziRoadsideMirrorIssueClause(
    input.lastOpenaiIntentTranscriptPreview ?? "",
    input.semanticNormalizedIssue ?? "",
  );
}

/** @deprecated Use {@link buildIiziRoadsideMirrorIssueClause}. */
export function getIiziRoadsideMirrorIssueSummary(state: IiziBrainRuntimeState): string {
  return buildIiziRoadsideMirrorIssueClause(state);
}

/** Instructions for a single controlled response.create (roadside only). */
export function formatIiziRoadsideMirrorControlledInstruction(state: IiziBrainRuntimeState): string {
  const issue = buildIiziRoadsideMirrorIssueClause(state);
  return (
    `Ütle AINULT üks lause eesti keeles, sõna-sõnalt (ärge lisage tervitust ega muud sisu enne või pärast): ` +
    `Sain aru, et Teil ${issue}. Saadan Teile nüüd SMS-i, kus saate sisestada auto registreerimisnumbri ja kinnitada oma asukoha.`
  );
}
