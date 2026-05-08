/**
 * Consensus merge — OpenAI vs Deepgram shadow pathways into SMS gate coarse intent.
 */

import type { BrainIntentSlug, PathwayIntentClassification } from "./iiziBrainConfigTypes.js";

export type ResolvedBrainIntent = BrainIntentSlug | "unknown_conflict";

export function mergePathwayIntents(
  oa: PathwayIntentClassification,
  dg: PathwayIntentClassification,
): { resolved: ResolvedBrainIntent; reason: string } {
  if (oa === dg) {
    const r = reasonBoth(oa);
    return { resolved: oa as ResolvedBrainIntent, reason: r };
  }

  if (oa === "unknown")
    return { resolved: dg as ResolvedBrainIntent, reason: `${dg}_clear_openai_unknown` };
  if (dg === "unknown")
    return { resolved: oa as ResolvedBrainIntent, reason: `${oa}_clear_deepgram_unknown` };

  if (
    (oa === "emergency_handoff" && dg === "roadside") ||
    (dg === "emergency_handoff" && oa === "roadside")
  ) {
    return { resolved: "emergency_handoff", reason: "emergency_escalates_over_roadside" };
  }

  return { resolved: "unknown_conflict", reason: "source_conflict" };
}

function reasonBoth(x: PathwayIntentClassification): string {
  switch (x) {
    case "unknown":
      return "both_unknown_or_unclear";
    case "roadside":
      return "both_agree_roadside";
    case "non_roadside":
      return "both_agree_non_roadside";
    case "emergency_handoff":
      return "both_agree_emergency_handoff";
    default:
      return "both_agree";
  }
}
