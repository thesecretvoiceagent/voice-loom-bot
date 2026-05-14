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
  /** When true, apply call-local pre-SMS decisive intent latch (IIZI combined inbound only). */
  preSmsIntentLatchActive?: boolean;
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
function isDecisivePreSmsIntent(r: ResolvedIntent): boolean {
  return r === "roadside" || r === "non_roadside" || r === "emergency_handoff";
}

/**
 * Affirmative / negative / branch replies after the pre-SMS clarification question
 * (“Kas Teil on vaja autoabi või on muu IIZI küsimus?” / legacy shorter variants).
 * Exported for smoke tests only — runtime uses {@link resolveFinalIntent}.
 */
export function matchYesNoRoadsideClarification(text: string): "yes" | "no" | null {
  const t = text
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!t) return null;

  // Non-roadside / office / policy cues (prefer before short “ja” yes).
  if (
    /\b(muu|kindlustus|kontor|arve|leping|poliis)\b/.test(t) &&
    t.length <= 120
  ) {
    return "no";
  }
  if (/^(ei|ei vaja|pole vaja)$/.test(t)) return "no";

  if (/^(jah|jaa|ja|muidugi)$/.test(t)) return "yes";
  if (/\b(on vaja|vajan|autoabi)\b/.test(t) && t.length <= 56) return "yes";
  if (
    /\b(diisel|bensiin|aku|puksiir|rehv|auto ei käivitu|auto ei sõida)\b/.test(t) &&
    t.length <= 96
  ) {
    return "yes";
  }
  return null;
}

function latchPreSmsIntentIfNeeded(
  state: IiziBrainRuntimeState,
  latchOn: boolean,
  candidate: ResolvedIntent,
  sourceLabel: string,
  ctx: IiziBrainResolveContext,
): void {
  if (!latchOn || !isDecisivePreSmsIntent(candidate)) return;
  if (state.preSmsLatchedIntent != null) return;
  state.preSmsLatchedIntent = candidate;
  console.log(
    `[IiziLatch] intent_latched intent=${candidate} source=${sourceLabel} callId=${ctx.callId || "?"}`,
  );
}

/**
 * Compute the final SMS-gate intent.
 *
 * Behavior:
 *   1. Optional yes/no resolution after clarification (narrow phrase match).
 *   2. Compute regex merge (existing logic).
 *   3. If regex consensus is clear (roadside / non_roadside / emergency_handoff) → keep it.
 *   4. If regex is unknown / unknown_conflict AND at least one transcript is non-empty,
 *      call semantic classifier when enabled.
 *   5. Apply pre-SMS latch (IIZI combined inbound): decisive intent cannot be downgraded
 *      to unknown / unknown_conflict by later non-decisive resolutions.
 */
export async function resolveFinalIntent(
  state: IiziBrainRuntimeState,
  ctx: IiziBrainResolveContext = {},
): Promise<void> {
  const oaText = state.lastOpenaiIntentTranscriptPreview || "";
  const dgText = state.lastDeepgramIntentTranscriptPreview || "";

  const latchOn =
    ctx.preSmsIntentLatchActive === true &&
    state.workflowPhase === "pre_sms_intent_gate" &&
    !state.combinedSmsSuccessfullySent;

  if (latchOn && state.awaitingYesNoRoadsideClarification) {
    const yn = matchYesNoRoadsideClarification(oaText) ?? matchYesNoRoadsideClarification(dgText);
    if (yn === "yes") {
      state.finalResolvedIntent = "roadside";
      state.intentResolutionReason = "yes_no_clarification_yes";
      state.classifierSource = "merge";
      state.transcriptSourceUsed = oaText.trim() ? "openai_realtime" : "deepgram";
      state.preSmsLatchedIntent = "roadside";
      state.awaitingYesNoRoadsideClarification = false;
      state.semanticIntent = "unknown";
      state.semanticConfidence = 0;
      state.semanticReason = "skipped_after_yes_no";
      state.semanticNormalizedIssue = "";
      state.semanticTranscriptSourceUsed = "none";
      console.log(
        `[IiziLatch] yes_no_clarification_resolved answer=yes resolved=roadside callId=${ctx.callId || "?"}`,
      );
      return;
    }
    if (yn === "no") {
      state.finalResolvedIntent = "non_roadside";
      state.intentResolutionReason = "yes_no_clarification_no";
      state.classifierSource = "merge";
      state.transcriptSourceUsed = oaText.trim() ? "openai_realtime" : "deepgram";
      state.preSmsLatchedIntent = "non_roadside";
      state.awaitingYesNoRoadsideClarification = false;
      state.semanticIntent = "unknown";
      state.semanticConfidence = 0;
      state.semanticReason = "skipped_after_yes_no";
      state.semanticNormalizedIssue = "";
      state.semanticTranscriptSourceUsed = "none";
      console.log(
        `[IiziLatch] yes_no_clarification_resolved answer=no resolved=non_roadside callId=${ctx.callId || "?"}`,
      );
      return;
    }
  }

  const regex = computeRegexMergedIntent(state);
  const regexClear =
    regex.resolved === "roadside" ||
    regex.resolved === "non_roadside" ||
    regex.resolved === "emergency_handoff";

  let candidate: ResolvedIntent;
  let reason: string;
  let classifierSource: "regex" | "semantic" | "merge";
  let transcriptSourceUsed: SemanticTranscriptSourceUsed;

  if (regexClear) {
    candidate = regex.resolved;
    reason = regex.reason;
    classifierSource = "regex";
    transcriptSourceUsed = chooseTranscriptSourceForRegex(state);
  } else if (!isSemanticEnabled(state)) {
    candidate = regex.resolved;
    reason = regex.reason;
    classifierSource = "regex";
    transcriptSourceUsed = "none";
  } else {
    const semantic = await callSemanticIfNeeded(state, ctx, oaText, dgText);
    if (!semantic) {
      candidate = regex.resolved;
      reason = `${regex.reason}_no_transcript_for_semantic`;
      classifierSource = "regex";
      transcriptSourceUsed = "none";
    } else {
      const threshold = getSemanticConfidenceMin();
      const semanticUsable =
        semantic.intent !== "unknown" && semantic.confidence >= threshold;

      if (!semanticUsable) {
        candidate = regex.resolved;
        reason =
          semantic.intent === "unknown"
            ? `${regex.reason}_semantic_unknown_${semantic.reason}`
            : `${regex.reason}_semantic_low_conf_${semantic.confidence.toFixed(2)}`;
        classifierSource = "merge";
        transcriptSourceUsed = semantic.transcript_source_used;
      } else {
        candidate = semantic.intent;
        reason =
          `semantic_${semantic.intent}_conf${semantic.confidence.toFixed(2)}` +
          `_src${semantic.transcript_source_used}_reason_${slugifyReason(semantic.reason)}`;
        classifierSource = "semantic";
        transcriptSourceUsed = semantic.transcript_source_used;
      }
    }
  }

  if (
    latchOn &&
    state.preSmsLatchedIntent != null &&
    isDecisivePreSmsIntent(state.preSmsLatchedIntent) &&
    (candidate === "unknown" || candidate === "unknown_conflict")
  ) {
    console.log(
      `[IiziLatch] downgrade_blocked from=${state.preSmsLatchedIntent} attempted=${candidate} ` +
        `reason=non_decisive_late_transcript callId=${ctx.callId || "?"}`,
    );
    state.finalResolvedIntent = state.preSmsLatchedIntent;
    state.intentResolutionReason = `latched_preserved_${state.preSmsLatchedIntent}_blocked_${candidate}`;
    state.classifierSource = classifierSource;
    state.transcriptSourceUsed = transcriptSourceUsed;
    return;
  }

  state.finalResolvedIntent = candidate;
  state.intentResolutionReason = reason;
  state.classifierSource = classifierSource;
  state.transcriptSourceUsed = transcriptSourceUsed;

  latchPreSmsIntentIfNeeded(state, latchOn, candidate, classifierSource, ctx);
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
