export type BrainUiSettings = {
  version: 1;
  enabled: boolean;
  providerMode: "shadow" | "soft_guard" | "hard_guard";
  speechTrustMode:
    | "prefer_deepgram_when_openai_unclear"
    | "ask_on_conflict"
    | "prefer_openai";
  unknownIntentBehavior: "ask_clarification" | "route_human";
  conflictBehavior: "ask_clarification" | "prefer_deepgram" | "prefer_openai";
  gates: {
    combinedSms: boolean;
    occupantCount: boolean;
    vehicleReadback: boolean;
    locationReadback: boolean;
    callbackConfirmation: boolean;
    endCall: boolean;
  };
  occupantPrerequisites: {
    formSubmitted: boolean;
    vehicleLookupMatchActive: boolean;
    locationConfirmed: boolean;
    vehicleReadbackComplete: boolean;
    locationReadbackComplete: boolean;
  };
  diagnostics: {
    brainDecision: boolean;
    toolBlocked: boolean;
    transcriptCompare: boolean;
  };
};

const cloneDefaults = (): BrainUiSettings => ({
  version: 1,
  enabled: true,
  providerMode: "soft_guard",
  speechTrustMode: "prefer_deepgram_when_openai_unclear",
  unknownIntentBehavior: "ask_clarification",
  conflictBehavior: "ask_clarification",
  gates: {
    combinedSms: true,
    occupantCount: true,
    vehicleReadback: true,
    locationReadback: true,
    callbackConfirmation: true,
    endCall: true,
  },
  occupantPrerequisites: {
    formSubmitted: true,
    vehicleLookupMatchActive: true,
    locationConfirmed: true,
    vehicleReadbackComplete: true,
    locationReadbackComplete: true,
  },
  diagnostics: {
    brainDecision: true,
    toolBlocked: true,
    transcriptCompare: true,
  },
});

export const DEFAULT_BRAIN_UI_SETTINGS: BrainUiSettings = cloneDefaults();

const isProviderMode = (v: unknown): v is BrainUiSettings["providerMode"] =>
  v === "shadow" || v === "soft_guard" || v === "hard_guard";

const isSpeechTrustMode = (v: unknown): v is BrainUiSettings["speechTrustMode"] =>
  v === "prefer_deepgram_when_openai_unclear" || v === "ask_on_conflict" || v === "prefer_openai";

const isUnknownIntent = (v: unknown): v is BrainUiSettings["unknownIntentBehavior"] =>
  v === "ask_clarification" || v === "route_human";

const isConflictBehavior = (v: unknown): v is BrainUiSettings["conflictBehavior"] =>
  v === "ask_clarification" || v === "prefer_deepgram" || v === "prefer_openai";

export function mergeBrainUiSettings(raw: unknown): BrainUiSettings {
  const d = cloneDefaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;

  const o = raw as Record<string, unknown>;

  const gatesIn =
    o.gates && typeof o.gates === "object" && !Array.isArray(o.gates)
      ? (o.gates as Record<string, unknown>)
      : {};
  const occIn =
    o.occupantPrerequisites && typeof o.occupantPrerequisites === "object" && !Array.isArray(o.occupantPrerequisites)
      ? (o.occupantPrerequisites as Record<string, unknown>)
      : {};
  const diagIn =
    o.diagnostics && typeof o.diagnostics === "object" && !Array.isArray(o.diagnostics)
      ? (o.diagnostics as Record<string, unknown>)
      : {};

  return {
    version: 1,
    enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
    providerMode: isProviderMode(o.providerMode) ? o.providerMode : d.providerMode,
    speechTrustMode: isSpeechTrustMode(o.speechTrustMode) ? o.speechTrustMode : d.speechTrustMode,
    unknownIntentBehavior: isUnknownIntent(o.unknownIntentBehavior) ? o.unknownIntentBehavior : d.unknownIntentBehavior,
    conflictBehavior: isConflictBehavior(o.conflictBehavior) ? o.conflictBehavior : d.conflictBehavior,
    gates: {
      combinedSms: typeof gatesIn.combinedSms === "boolean" ? gatesIn.combinedSms : d.gates.combinedSms,
      occupantCount: typeof gatesIn.occupantCount === "boolean" ? gatesIn.occupantCount : d.gates.occupantCount,
      vehicleReadback: typeof gatesIn.vehicleReadback === "boolean" ? gatesIn.vehicleReadback : d.gates.vehicleReadback,
      locationReadback: typeof gatesIn.locationReadback === "boolean" ? gatesIn.locationReadback : d.gates.locationReadback,
      callbackConfirmation:
        typeof gatesIn.callbackConfirmation === "boolean" ? gatesIn.callbackConfirmation : d.gates.callbackConfirmation,
      endCall: typeof gatesIn.endCall === "boolean" ? gatesIn.endCall : d.gates.endCall,
    },
    occupantPrerequisites: {
      formSubmitted: typeof occIn.formSubmitted === "boolean" ? occIn.formSubmitted : d.occupantPrerequisites.formSubmitted,
      vehicleLookupMatchActive:
        typeof occIn.vehicleLookupMatchActive === "boolean"
          ? occIn.vehicleLookupMatchActive
          : d.occupantPrerequisites.vehicleLookupMatchActive,
      locationConfirmed:
        typeof occIn.locationConfirmed === "boolean" ? occIn.locationConfirmed : d.occupantPrerequisites.locationConfirmed,
      vehicleReadbackComplete:
        typeof occIn.vehicleReadbackComplete === "boolean"
          ? occIn.vehicleReadbackComplete
          : d.occupantPrerequisites.vehicleReadbackComplete,
      locationReadbackComplete:
        typeof occIn.locationReadbackComplete === "boolean"
          ? occIn.locationReadbackComplete
          : d.occupantPrerequisites.locationReadbackComplete,
    },
    diagnostics: {
      brainDecision: typeof diagIn.brainDecision === "boolean" ? diagIn.brainDecision : d.diagnostics.brainDecision,
      toolBlocked: typeof diagIn.toolBlocked === "boolean" ? diagIn.toolBlocked : d.diagnostics.toolBlocked,
      transcriptCompare:
        typeof diagIn.transcriptCompare === "boolean" ? diagIn.transcriptCompare : d.diagnostics.transcriptCompare,
    },
  };
}
