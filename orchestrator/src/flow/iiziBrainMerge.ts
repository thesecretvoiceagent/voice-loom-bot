/**
 * Consensus merge — OpenAI Realtime vs Deepgram shadow pathways into SMS gate coarse intent.
 * Deepgram is the preferred transcript signal for roadside vs non-roadside when pathways disagree;
 * OpenAI non_roadside vs Deepgram roadside is treated as a hard conflict (SMS blocked).
 */

import type { BrainIntentSlug, PathwayIntentClassification } from "./iiziBrainConfigTypes.js";

export type ResolvedBrainIntent = BrainIntentSlug | "unknown_conflict";

/**
 * Merge per-pathway classifications (OpenAI = oa, Deepgram = dg).
 * Emergency handoff wins over commercial intents when either pathway reports it.
 */
export function mergePathwayIntents(
  oa: PathwayIntentClassification,
  dg: PathwayIntentClassification,
): { resolved: ResolvedBrainIntent; reason: string } {
  if (oa === dg) {
    return { resolved: oa as ResolvedBrainIntent, reason: reasonBoth(oa) };
  }

  const hasEmergency = oa === "emergency_handoff" || dg === "emergency_handoff";
  if (hasEmergency) {
    return { resolved: "emergency_handoff", reason: "emergency_handoff_escalates" };
  }

  // Hard conflict: opposite commercial intents (SMS must stay blocked)
  if (dg === "roadside" && oa === "non_roadside") {
    return {
      resolved: "unknown_conflict",
      reason: "source_conflict_openai_non_roadside_vs_deepgram_roadside",
    };
  }
  if (oa === "roadside" && dg === "non_roadside") {
    return {
      resolved: "unknown_conflict",
      reason: "source_conflict_openai_roadside_vs_deepgram_non_roadside",
    };
  }

  // Deepgram clear roadside — OpenAI is not non_roadside (conflicts handled above)
  if (dg === "roadside") {
    return { resolved: "roadside", reason: "deepgram_roadside_preferred" };
  }

  // OpenAI roadside, Deepgram unclear/missing
  if (oa === "roadside" && dg === "unknown") {
    return { resolved: "roadside", reason: "openai_roadside_deepgram_unknown" };
  }

  // OpenAI non-roadside but Deepgram unclear — do not trust OpenAI alone; clarify
  if (oa === "non_roadside" && dg === "unknown") {
    return { resolved: "unknown", reason: "openai_non_roadside_deepgram_unknown_ask_clarification" };
  }

  // Deepgram non-roadside, OpenAI unclear — clarify
  if (oa === "unknown" && dg === "non_roadside") {
    return { resolved: "unknown", reason: "deepgram_non_roadside_openai_unknown_ask_clarification" };
  }

  return { resolved: "unknown_conflict", reason: "source_conflict_unhandled_pair" };
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
