/**
 * Backend-owned intent resolver that combines regex (fast, deterministic) with a
 * semantic LLM classifier (compact, fallback) into the final SMS-gate intent.
 *
 * Source-of-truth: the deterministic backend brain — Realtime voice agent never decides
 * intent/tool permission by itself. Regex stays the fast path; semantic only runs when
 * regex is unknown (or conflicts) and at least one transcript is present.
 *
 * Hard rules:
 *  - regex emergency_handoff (either pathway) is never overridden by semantic.
 *  - regex explicit non_roadside denial is never overridden by semantic (denial wins).
 *  - semantic can lift `unknown` / `unknown_conflict` to roadside / non_roadside / emergency_handoff
 *    only when its confidence meets the threshold; otherwise resolution stays as-is.
 *  - Fully cached by transcript pair so we never re-call within the same turn.
 */

import type { IiziBrainRuntimeState, ResolvedIntent } from "./iiziBrain.js";
import { logIiziBrainIntentResolution } from "./iiziBrain.js";
import { mergePathwayIntents, type MergePathwayOptions } from "./iiziBrainMerge.js";
import { runtimeBrainUiUsesLegacyPathwayMerge } from "../brain/agentBrainUiTypes.js";
import {
  classifyIntentSemantic,
  type SemanticClassifierInput,
  type SemanticClassifierResult,
  type SemanticTranscriptSourceUsed,
} from "./iiziSemanticClassifier.js";

export interface IiziBrainResolveContext {
  callId?: string | null;
  call_direction?: "inbound" | "outbound";
  agent_domain?: string;
  caller_known?: boolean;
  last_bot_question?: string;
}

const DEFAULT_SEMANTIC_CONFIDENCE_MIN = 0.6;

function getSemanticConfidenceMin(): number {
  const raw = Number(process.env.IIZI_SEMANTIC_CONFIDENCE_MIN);
  if (!Number.isFinite(raw)) return DEFAULT_SEMANTIC_CONFIDENCE_MIN;
  return Math.max(0, Math.min(1, raw));
}

function isSemanticEnabled(state: IiziBrainRuntimeState): boolean {
  if (process.env.IIZI_SEMANTIC_CLASSIFIER_ENABLED === "0") return false;
  if (state.runtimeBrainUi?.enabled === false) {
    // Brain UI disabled → keep behavior fully legacy regex.
    return false;
  }
  return true;
}

function buildSemanticInputKey(oaText: string, dgText: string): string {
  return `oa=${oaText.slice(0, 240)}|dg=${dgText.slice(0, 240)}`;
}

function chooseTranscriptSourceForRegex(state: IiziBrainRuntimeState): SemanticTranscriptSourceUsed {
  const oa = state.openaiRealtimeIntent;
  const dg = state.deepgramShadowIntent;
  const oaHasText = (state.lastOpenaiIntentTranscriptPreview || "").trim().length > 0;
  const dgHasText = (state.lastDeepgramIntentTranscriptPreview || "").trim().length > 0;

  if (oa !== "unknown" && dg !== "unknown" && oa === dg) {
    if (oaHasText && dgHasText) return "both";
    return oaHasText ? "openai_realtime" : "deepgram";
  }
  if (dg !== "unknown") return "deepgram";
  if (oa !== "unknown") return "openai_realtime";
  if (oaHasText && dgHasText) return "both";
  if (dgHasText) return "deepgram";
  if (oaHasText) return "openai_realtime";
  return "none";
}

function computeRegexMergedIntent(state: IiziBrainRuntimeState): {
  resolved: ResolvedIntent;
  reason: string;
} {
  const ui = state.runtimeBrainUi;
  const useLegacy = !ui.enabled || runtimeBrainUiUsesLegacyPathwayMerge(ui);
  const opts: MergePathwayOptions | undefined = useLegacy
    ? undefined
    : { speechTrustMode: ui.speechTrustMode, conflictBehavior: ui.conflictBehavior };
  return mergePathwayIntents(state.openaiRealtimeIntent, state.deepgramShadowIntent, opts);
}

function setSemanticFieldsOnState(
  state: IiziBrainRuntimeState,
  result: SemanticClassifierResult,
  inputKey: string,
): void {
  state.semanticIntent = result.intent;
  state.semanticConfidence = result.confidence;
  state.semanticReason = result.reason;
  state.semanticNormalizedIssue = result.normalized_issue;
  state.semanticTranscriptSourceUsed = result.transcript_source_used;
  state.semanticLastInputKey = inputKey;
}

async function callSemanticIfNeeded(
  state: IiziBrainRuntimeState,
  ctx: IiziBrainResolveContext,
  oaText: string,
  dgText: string,
): Promise<SemanticClassifierResult | null> {
  const inputKey = buildSemanticInputKey(oaText, dgText);
  if (state.semanticLastInputKey === inputKey && state.semanticIntent !== "unknown") {
    return {
      intent: state.semanticIntent,
      confidence: state.semanticConfidence,
      reason: state.semanticReason,
      normalized_issue: state.semanticNormalizedIssue,
      transcript_source_used: state.semanticTranscriptSourceUsed,
    };
  }
  if (!oaText.trim() && !dgText.trim()) {
    return null;
  }

  const input: SemanticClassifierInput = {
    call_direction: ctx.call_direction || "inbound",
    agent_domain: ctx.agent_domain || "IIZI roadside assistance intake",
    current_phase: String(state.workflowPhase),
    previous_resolved_intent: String(state.finalResolvedIntent),
    openai_transcript: oaText,
    deepgram_transcript: dgText,
    caller_known: ctx.caller_known === true,
    last_bot_question: ctx.last_bot_question || "",
    business_policy_summary:
      "Classify whether caller needs roadside assistance before any SMS/tool action.",
  };

  const t0 = Date.now();
  const result = await classifyIntentSemantic(input);
  const elapsedMs = Date.now() - t0;
  setSemanticFieldsOnState(state, result, inputKey);
  console.log(
    `[SemanticClassifier] callId=${ctx.callId || "?"} intent=${result.intent} ` +
      `conf=${result.confidence.toFixed(2)} src=${result.transcript_source_used} ` +
      `reason="${result.reason}" issue="${result.normalized_issue}" elapsedMs=${elapsedMs}`,
  );
  return result;
}

/**
 * Compute the final SMS-gate intent.
 *
 * Behavior:
 *   1. Compute regex merge (existing logic).
 *   2. If regex consensus is clear (roadside / non_roadside / emergency_handoff) → keep it.
 *      Set classifierSource=regex and transcriptSourceUsed based on which pathway resolved it.
 *   3. If regex is unknown / unknown_conflict AND at least one transcript is non-empty,
 *      call semantic classifier.
 *      - If semantic returns a clear intent with confidence >= threshold:
 *          * Never override regex emergency_handoff (already handled in step 2).
 *          * Apply semantic intent as final.
 *      - Else keep regex result.
 *   4. Always update `finalResolvedIntent`, `intentResolutionReason`,
 *      `classifierSource`, `transcriptSourceUsed` on state.
 */
export async function resolveFinalIntent(
  state: IiziBrainRuntimeState,
  ctx: IiziBrainResolveContext = {},
): Promise<void> {
  const oaText = state.lastOpenaiIntentTranscriptPreview || "";
  const dgText = state.lastDeepgramIntentTranscriptPreview || "";

  const regex = computeRegexMergedIntent(state);
  const regexClear =
    regex.resolved === "roadside" ||
    regex.resolved === "non_roadside" ||
    regex.resolved === "emergency_handoff";

  if (regexClear) {
    state.finalResolvedIntent = regex.resolved;
    state.intentResolutionReason = regex.reason;
    state.classifierSource = "regex";
    state.transcriptSourceUsed = chooseTranscriptSourceForRegex(state);
    return;
  }

  if (!isSemanticEnabled(state)) {
    state.finalResolvedIntent = regex.resolved;
    state.intentResolutionReason = regex.reason;
    state.classifierSource = "regex";
    state.transcriptSourceUsed = "none";
    return;
  }

  const semantic = await callSemanticIfNeeded(state, ctx, oaText, dgText);
  if (!semantic) {
    state.finalResolvedIntent = regex.resolved;
    state.intentResolutionReason = `${regex.reason}_no_transcript_for_semantic`;
    state.classifierSource = "regex";
    state.transcriptSourceUsed = "none";
    return;
  }

  const threshold = getSemanticConfidenceMin();
  const semanticUsable =
    semantic.intent !== "unknown" && semantic.confidence >= threshold;

  if (!semanticUsable) {
    state.finalResolvedIntent = regex.resolved;
    state.intentResolutionReason =
      semantic.intent === "unknown"
        ? `${regex.reason}_semantic_unknown_${semantic.reason}`
        : `${regex.reason}_semantic_low_conf_${semantic.confidence.toFixed(2)}`;
    state.classifierSource = "merge";
    state.transcriptSourceUsed = semantic.transcript_source_used;
    return;
  }

  state.finalResolvedIntent = semantic.intent;
  state.intentResolutionReason =
    `semantic_${semantic.intent}_conf${semantic.confidence.toFixed(2)}` +
    `_src${semantic.transcript_source_used}_reason_${slugifyReason(semantic.reason)}`;
  state.classifierSource = "semantic";
  state.transcriptSourceUsed = semantic.transcript_source_used;
}

/** Convenience wrapper: resolve, then log. Use this from media-stream. */
export async function resolveAndLogFinalIntent(
  state: IiziBrainRuntimeState,
  ctx: IiziBrainResolveContext,
): Promise<void> {
  await resolveFinalIntent(state, ctx);
  logIiziBrainIntentResolution(ctx.callId || null, state);
}

function slugifyReason(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
