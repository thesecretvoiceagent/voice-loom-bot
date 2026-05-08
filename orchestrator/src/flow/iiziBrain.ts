/**
 * Limited deterministic backend "brain" for IIZI combined SMS inbound calls only.
 * Enforces SMS gate on consensus intent across OpenAI transcript vs Deepgram shadow STT.
 */

export type IntentClassification = "unknown" | "roadside" | "non_roadside";
/** Resolved triage outcome when ASR pathways disagree */
export type ResolvedIntent = IntentClassification | "unknown_conflict";
export type BrainControlMode = "observe" | "suggest" | "control";

export type IiziBrainWorkflowPhase =
  | "pre_sms_intent_gate"
  | "waiting_for_form_and_location"
  | "form_submitted"
  | "location_confirmed"
  | "waiting_for_vehicle_lookup"
  | "vehicle_lookup_match_active"
  | "vehicle_lookup_match_inactive"
  | "vehicle_lookup_no_match";

export interface IiziBrainGuardResults {
  passed: boolean;
  failures: string[];
}

export type BrainTranscriptSource = "deepgram_shadow" | "openai_realtime" | "none";

export interface IiziBrainEvaluateResult {
  observedEvent: string;
  state: string;
  /** Mirrors finalResolvedIntent for planner consumers */
  intentClassification: ResolvedIntent;
  /** Per-pathway keyword signals (sticky until a new clear keyword hit on that pathway) */
  sourceIntentOpenAI: IntentClassification;
  sourceIntentDeepgram: IntentClassification;
  finalResolvedIntent: ResolvedIntent;
  intentResolutionReason: string;
  /** Human-readable SMS policy line for logs (also inside gateSms output) */
  smsGateReason: string;
  expectedNextAction: string;
  transcriptSource: BrainTranscriptSource;
  guardResults: IiziBrainGuardResults;
  controlMode: BrainControlMode;
}

export interface IiziBrainRuntimeState {
  workflowPhase: IiziBrainWorkflowPhase | "idle";
  greetingPlaybackComplete: boolean;
  combinedSmsSuccessfullySent: boolean;
  formSeenAfterSms: boolean;
  locationSeenAfterSms: boolean;
  silenceSignalCount: number;
  lastObservedEvent: string;
  lastTranscriptSource: BrainTranscriptSource;

  /** Last clear keyword-derived intent per ASR pathway; "unknown" = no classified hit yet */
  openaiRealtimeIntent: IntentClassification;
  deepgramShadowIntent: IntentClassification;

  /** Merged SMS policy intent — never blindly “last transcript wins”. */
  finalResolvedIntent: ResolvedIntent;
  intentResolutionReason: string;
}

const ROADSIDE_HINTS =
  /\b(avari(i|)|õnnetus|auto\s*abi|autoabi|rehv|kumm|ratas(tega|)|jäin\s+teele|teele\s+jäänud|ei\s+käivi|ei\s+käivitu|käimatuse|mootor|vedelik|kütus(bens|)|krahh|kahjustus|(varu\s*))?ratta(d|)|(teel\s+abi)|(abi\s*vaja\s+tee)/i;

const NON_ROADSIDE_HINTS =
  /\b(ei\s+vaja\s+(auto\s*)?abi|pole\s+(auto\s*)?abi(\s*küsimus)?|pole\s+tegemist\s+(õnnetus|avar)|ainult\s+kontor(i|)|(tagasi)?helistage(\s*hilisemalt)?|\barve(tega|)|(mitte\s+(auto\s*)?abi)|väär\s+numer|pole\s+nöör(i|)|(arutame\s+hind)|müüg|tellimus(tega|)|(lihtsalt\s+infot)|(sooviks(in|)?\s+teada(\s*kui))?)/i;

function resolveMergedIntent(
  oa: IntentClassification,
  dg: IntentClassification,
): { resolved: ResolvedIntent; reason: string } {
  if (oa === "roadside" && dg === "roadside") return { resolved: "roadside", reason: "both_agree_roadside" };
  if (oa === "non_roadside" && dg === "non_roadside") {
    return { resolved: "non_roadside", reason: "both_agree_non_roadside" };
  }

  const conflictPair =
    (oa === "roadside" && dg === "non_roadside") || (oa === "non_roadside" && dg === "roadside");
  if (conflictPair) {
    return { resolved: "unknown_conflict", reason: "source_conflict" };
  }

  if (oa === "roadside" && dg === "unknown") return { resolved: "roadside", reason: "openai_clear_deepgram_unknown" };
  if (dg === "roadside" && oa === "unknown") return { resolved: "roadside", reason: "deepgram_clear_openai_unknown" };

  if (oa === "non_roadside" && dg === "unknown") {
    return { resolved: "non_roadside", reason: "openai_clear_deepgram_unknown" };
  }
  if (dg === "non_roadside" && oa === "unknown") {
    return { resolved: "non_roadside", reason: "deepgram_clear_openai_unknown" };
  }

  return { resolved: "unknown", reason: "both_unknown_or_unclear" };
}

function recomputeFinalIntent(state: IiziBrainRuntimeState): void {
  const { resolved, reason } = resolveMergedIntent(state.openaiRealtimeIntent, state.deepgramShadowIntent);
  state.finalResolvedIntent = resolved;
  state.intentResolutionReason = reason;
}

/** Conservative keyword classify from user speech */
export function classifyIntentFromSpeech(text: string): IntentClassification | null {
  const t = text.trim();
  if (!t) return null;
  if (NON_ROADSIDE_HINTS.test(t)) return "non_roadside";
  if (ROADSIDE_HINTS.test(t)) return "roadside";
  return null;
}

export function createInitialIiziBrainState(): IiziBrainRuntimeState {
  const s: IiziBrainRuntimeState = {
    workflowPhase: "pre_sms_intent_gate",
    greetingPlaybackComplete: false,
    combinedSmsSuccessfullySent: false,
    formSeenAfterSms: false,
    locationSeenAfterSms: false,
    silenceSignalCount: 0,
    lastObservedEvent: "init",
    lastTranscriptSource: "none",
    openaiRealtimeIntent: "unknown",
    deepgramShadowIntent: "unknown",
    finalResolvedIntent: "unknown",
    intentResolutionReason: "both_unknown_or_unclear",
  };
  recomputeFinalIntent(s);
  return s;
}

/** Log deterministic merge line after source updates */
export function logIiziBrainIntentResolution(callId: string | null, state: IiziBrainRuntimeState): void {
  const cid = callId || "?";
  const gate = smsGatePeek(state);
  console.log(
    `[IIZI-Brain] intent_resolution openai=${state.openaiRealtimeIntent} deepgram=${state.deepgramShadowIntent} resolved=${state.finalResolvedIntent} reason=${state.intentResolutionReason} sourceIntentOpenAI=${state.openaiRealtimeIntent} sourceIntentDeepgram=${state.deepgramShadowIntent} resolvedIntent=${state.finalResolvedIntent} intentResolutionReason=${state.intentResolutionReason} smsGateReason=${gate.smsGateReason} callId=${cid}`,
  );
}

function smsGatePeek(state: IiziBrainRuntimeState): {
  smsGateReason: string;
  wouldAllow: boolean;
  reasonCode: string;
} {
  const gate = gateIiziCombinedSms(state);
  return {
    smsGateReason: gate.smsGateReason,
    wouldAllow: gate.allow,
    reasonCode: gate.reasonCode,
  };
}

export function ingestIiziBrainNonemptyUserSpeech(state: IiziBrainRuntimeState, text: string): void {
  state.silenceSignalCount = 0;
  state.lastTranscriptSource = "openai_realtime";
  const c = classifyIntentFromSpeech(text);
  if (c) state.openaiRealtimeIntent = c;
  recomputeFinalIntent(state);
  state.lastObservedEvent = c ? `user_transcript.${c}` : "user_transcript.unclear_needs_intent_question";
}

/** Deepgram finals: strengthens merge only via deepgramShadowIntent; does not wipe OpenAI pathway */
export function ingestIiziBrainTrustedShadowFinal(
  state: IiziBrainRuntimeState,
  provider: string,
  text: string,
): {
  skippedAggressiveMutation: boolean;
  /** True after a substantive final (>3 chars): log merged intent snapshot */
  shouldLogIntentResolution: boolean;
} {
  state.lastTranscriptSource = "deepgram_shadow";

  const t = text.trim();
  if (!t) {
    state.lastObservedEvent = `trusted_transcript_shadow.${provider}.empty`;
    return { skippedAggressiveMutation: true, shouldLogIntentResolution: false };
  }

  const shortAndAmbiguous = t.length < 4;
  if (shortAndAmbiguous) {
    state.lastObservedEvent = `trusted_transcript_shadow.${provider}.low_signal`;
    return { skippedAggressiveMutation: true, shouldLogIntentResolution: false };
  }

  state.lastObservedEvent = `trusted_transcript_shadow.${provider}.final`;
  const c = classifyIntentFromSpeech(t);
  if (c) {
    state.deepgramShadowIntent = c;
    state.silenceSignalCount = 0;
    recomputeFinalIntent(state);
    return { skippedAggressiveMutation: false, shouldLogIntentResolution: true };
  }

  return { skippedAggressiveMutation: true, shouldLogIntentResolution: true };
}

export function ingestIiziBrainGreetingComplete(state: IiziBrainRuntimeState): void {
  state.greetingPlaybackComplete = true;
  state.lastObservedEvent = "greeting_completed";
}

/** Empty Whisper completion — informational silence */
export function ingestIiziBrainEmptyTranscript(state: IiziBrainRuntimeState): void {
  state.lastObservedEvent = "user_transcript_empty";
  const noClearYet =
    state.finalResolvedIntent === "unknown" || state.finalResolvedIntent === "unknown_conflict";
  if (!state.greetingPlaybackComplete || !noClearYet) return;
  state.silenceSignalCount = Math.min(99, state.silenceSignalCount + 1);
}

export type IiziBrainFlowIngestKind =
  | "call_started"
  | "combined_sms_sent"
  | "form_submitted"
  | "location_confirmed"
  | "vehicle_lookup_result"
  | "call_ended";

export function ingestIiziBrainFlow(
  state: IiziBrainRuntimeState,
  kind: IiziBrainFlowIngestKind,
  payload?: Record<string, unknown>,
): void {
  state.lastObservedEvent = kind;
  switch (kind) {
    case "call_started":
      state.workflowPhase = "pre_sms_intent_gate";
      state.lastTranscriptSource = "none";
      state.openaiRealtimeIntent = "unknown";
      state.deepgramShadowIntent = "unknown";
      recomputeFinalIntent(state);
      state.intentResolutionReason = "call_started_reset";
      break;
    case "combined_sms_sent":
      state.workflowPhase = "waiting_for_form_and_location";
      state.combinedSmsSuccessfullySent = true;
      state.formSeenAfterSms = false;
      state.locationSeenAfterSms = false;
      break;
    case "form_submitted":
      if (!state.combinedSmsSuccessfullySent) break;
      state.formSeenAfterSms = true;
      state.workflowPhase =
        state.formSeenAfterSms && state.locationSeenAfterSms ? "waiting_for_vehicle_lookup" : "form_submitted";
      break;
    case "location_confirmed":
      if (!state.combinedSmsSuccessfullySent) break;
      state.locationSeenAfterSms = true;
      state.workflowPhase =
        state.formSeenAfterSms && state.locationSeenAfterSms ? "waiting_for_vehicle_lookup" : "location_confirmed";
      break;
    case "vehicle_lookup_result": {
      if (!state.combinedSmsSuccessfullySent) break;
      const match = payload?.match === true;
      const coverageInvalid = payload?.coverage_invalid === true;
      if (!match) {
        state.workflowPhase = "vehicle_lookup_no_match";
      } else if (coverageInvalid) {
        state.workflowPhase = "vehicle_lookup_match_inactive";
      } else {
        state.workflowPhase = "vehicle_lookup_match_active";
      }
      break;
    }
    case "call_ended":
      state.workflowPhase = "idle";
      state.lastObservedEvent = "call_ended";
      state.lastTranscriptSource = "none";
      state.openaiRealtimeIntent = "unknown";
      state.deepgramShadowIntent = "unknown";
      recomputeFinalIntent(state);
      state.intentResolutionReason = "call_ended_reset";
      break;
    default:
      break;
  }
}

/** Whether combined SMS may be delivered — uses merged intent only */
export function gateIiziCombinedSms(state: IiziBrainRuntimeState): {
  allow: boolean;
  reasonCode: string;
  message: string;
  smsGateReason: string;
} {
  const r = state.finalResolvedIntent;

  if (r === "unknown_conflict") {
    return {
      allow: false,
      reasonCode: "intent_conflict",
      smsGateReason: "sms_blocked_intent_conflict_openai_vs_deepgram",
      message:
        "Roadside intent is unclear — OpenAI transcript and Deepgram shadow disagree on roadside vs non-roadside. Do NOT send the combined roadside SMS yet. Verbally reconcile what the caller needs; do not escalate to SMS until consensus.",
    };
  }
  if (r === "non_roadside") {
    return {
      allow: false,
      reasonCode: "intent_non_roadside",
      smsGateReason: "sms_blocked_merged_non_roadside_intent",
      message:
        'Merged intent is NON-roadside. Do NOT send roadside SMS templates. Explain briefly that this line is for autoabi and offer transfer to human / callback.',
    };
  }
  if (r === "unknown") {
    return {
      allow: false,
      reasonCode: "intent_unknown",
      smsGateReason: "sms_blocked_merged_unknown_intent",
      message:
        "Merged roadside intent is unknown. Ask whether the caller needs roadside/emergency roadside assistance before sending the combined SMS. Do NOT send SMS until clarified.",
    };
  }
  return {
    allow: true,
    reasonCode: "roadside_detected",
    smsGateReason: "sms_allowed_merged_roadside_intent",
    message: "Allowed: merged intent is roadside — combined roadside SMS permitted by policy.",
  };
}

function guardSmsIntent(state: IiziBrainRuntimeState): IiziBrainGuardResults {
  const failures: string[] = [];
  const r = state.finalResolvedIntent;
  if (r === "unknown_conflict") failures.push("intent_conflict");
  if (r === "unknown") failures.push("intent_unknown");
  if (r === "non_roadside") failures.push("intent_non_roadside");
  return { passed: failures.length === 0, failures };
}

export function deriveExpectedNextActionBrain(state: IiziBrainRuntimeState): string {
  const intentForSilenceBranch: IntentClassification =
    state.finalResolvedIntent === "unknown_conflict"
      ? "unknown"
      : state.finalResolvedIntent;

  if (
    state.greetingPlaybackComplete &&
    intentForSilenceBranch === "unknown" &&
    state.workflowPhase === "pre_sms_intent_gate"
  ) {
    if (!state.combinedSmsSuccessfullySent && state.silenceSignalCount === 0) {
      return "ask_if_caller_needs_roadside_assistance";
    }
    if (state.silenceSignalCount === 1) return "ask_if_anyone_is_there";
    if (state.silenceSignalCount === 2) return "explain_autoabi_or_human_route";
    if (state.silenceSignalCount >= 3) return "graceful_close_or_handoff";
  }

  switch (state.finalResolvedIntent) {
    case "unknown":
    case "unknown_conflict":
      return "ask_if_caller_needs_roadside_assistance";
    case "non_roadside":
      return "route_non_roadside_to_human";
    case "roadside":
      if (!state.combinedSmsSuccessfullySent && state.workflowPhase === "pre_sms_intent_gate") {
        return "send_combined_reg_location_sms";
      }
      if (state.workflowPhase === "waiting_for_form_and_location") return "wait_for_form_and_location";
      if (state.workflowPhase === "form_submitted" || state.workflowPhase === "location_confirmed") {
        return "wait_for_vehicle_lookup";
      }
      break;
    default:
      break;
  }

  switch (state.workflowPhase) {
    case "waiting_for_vehicle_lookup":
      return "wait_for_vehicle_lookup";
    case "vehicle_lookup_match_active":
      return "say_vehicle_and_location_once_then_continue";
    case "vehicle_lookup_match_inactive":
    case "vehicle_lookup_no_match":
      return "route_to_human";
    default:
      return "observe";
  }
}

export function evaluateIiziBrain(state: IiziBrainRuntimeState, controlSmsGateActive: boolean): IiziBrainEvaluateResult {
  const guardResults = guardSmsIntent(state);
  const wf = state.workflowPhase;
  const coarseState =
    state.finalResolvedIntent === "unknown" || state.finalResolvedIntent === "unknown_conflict"
      ? `intent_triage.${wf}`
      : `${state.finalResolvedIntent}.${wf}`;
  const gateSnapshot = smsGatePeek(state);
  const expectedNextAction = deriveExpectedNextActionBrain(state);
  return {
    observedEvent: state.lastObservedEvent,
    state: coarseState,
    intentClassification: state.finalResolvedIntent,
    sourceIntentOpenAI: state.openaiRealtimeIntent,
    sourceIntentDeepgram: state.deepgramShadowIntent,
    finalResolvedIntent: state.finalResolvedIntent,
    intentResolutionReason: state.intentResolutionReason,
    smsGateReason: gateSnapshot.smsGateReason,
    expectedNextAction,
    transcriptSource: state.lastTranscriptSource,
    guardResults,
    controlMode: controlSmsGateActive ? "control" : "observe",
  };
}

export function logIiziBrainTrustedShadowTranscript(
  callId: string | null,
  sourceProvider: string,
  textSlice: string,
  snap: IiziBrainEvaluateResult,
): void {
  const preview = textSlice.slice(0, 220).replace(/\s+/g, " ").trim();
  console.log(
    `[IIZI-Brain] event=trusted_transcript_shadow source=${sourceProvider} transcriptSource=${snap.transcriptSource} intent=${snap.intentClassification} sourceIntentOpenAI=${snap.sourceIntentOpenAI} sourceIntentDeepgram=${snap.sourceIntentDeepgram} resolvedIntent=${snap.finalResolvedIntent} intentResolutionReason=${snap.intentResolutionReason} smsGateReason=${snap.smsGateReason} text="${preview}" state=${snap.state} expectedNextAction=${snap.expectedNextAction} controlMode=${snap.controlMode} callId=${callId || "?"} guardsPassed=${snap.guardResults.passed}`,
  );
}

export function logIiziBrainSnapshot(callId: string | null, snap: IiziBrainEvaluateResult): void {
  const id = callId || "?";
  console.log(
    `[IIZI-Brain] event=${snap.observedEvent} state=${snap.state} intent=${snap.intentClassification} sourceIntentOpenAI=${snap.sourceIntentOpenAI} sourceIntentDeepgram=${snap.sourceIntentDeepgram} resolvedIntent=${snap.finalResolvedIntent} intentResolutionReason=${snap.intentResolutionReason} smsGateReason=${snap.smsGateReason} transcriptSource=${snap.transcriptSource} expectedNextAction=${snap.expectedNextAction} controlMode=${snap.controlMode} callId=${id} guardsPassed=${snap.guardResults.passed}`,
  );
}
