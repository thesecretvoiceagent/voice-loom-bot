/**
 * Backend-owned Estonian copy for IIZI inbound roadside controlled assistant turn
 * (pre–combined-SMS). Keeps the model from inventing a different issue summary.
 */

import type { IiziBrainRuntimeState } from "./iiziBrain.js";

const MIRROR_ISSUE_MAX_LEN = 96;

function scrubMirrorFragment(raw: string): string {
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

/**
 * Short issue clause after "Saan aru, et Teil …" — prefer semantic normalized label,
 * else a clipped OpenAI intent transcript preview.
 */
export function getIiziRoadsideMirrorIssueSummary(state: IiziBrainRuntimeState): string {
  const norm = scrubMirrorFragment(state.semanticNormalizedIssue || "");
  if (norm.length >= 3) return clipMirrorFragment(norm, MIRROR_ISSUE_MAX_LEN);
  const prev = scrubMirrorFragment(state.lastOpenaiIntentTranscriptPreview || "");
  if (prev.length >= 3) return clipMirrorFragment(prev, MIRROR_ISSUE_MAX_LEN);
  return "on autoabi vajadus";
}

/** Instructions for a single controlled response.create (roadside only). */
export function formatIiziRoadsideMirrorControlledInstruction(state: IiziBrainRuntimeState): string {
  const issue = getIiziRoadsideMirrorIssueSummary(state);
  return (
    `Ütle AINULT üks lause eesti keeles, sõna-sõnalt (ärge lisage tervitust ega muud sisu enne või pärast): ` +
    `Saan aru, et Teil ${issue}. Saadan Teile nüüd SMS-i, kus saate sisestada auto registreerimisnumbri ja kinnitada oma asukoha.`
  );
}
