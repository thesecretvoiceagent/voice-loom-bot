import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "",
    get isConfigured() {
      return !!(this.accountSid && this.authToken && this.fromNumber);
    },
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview-2024-12-17",
    // Deterministic text-to-speech for scripted lines. When enabled, every agent
    // utterance (greeting + every scripted line) is synthesized verbatim via this
    // TTS endpoint and streamed straight to Twilio, so the generative model can
    // never improvise or hallucinate the wording. The realtime model is then only
    // used for listening (transcription/VAD).
    ttsEnabled: (process.env.IIZI_TTS_ENABLED ?? "true").toLowerCase() !== "false",
    ttsModel: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    ttsVoice: process.env.OPENAI_TTS_VOICE || "sage",
    // Numeric speed only applies to the legacy tts-1 / tts-1-hd models. The
    // gpt-4o-mini-tts model ignores `speed`; for it we steer pace via instructions.
    ttsSpeed: Number(process.env.OPENAI_TTS_SPEED || "1.3"),
    ttsInstructions:
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      "Räägi soojalt, rõõmsalt ja sõbralikult — naeratava, positiivse ja abivalmis tooniga. " +
        "Hääl on energiline ja elav, kuid samas rahulik ja professionaalne. " +
        "Räägi selges eesti keeles, kiires ja loomulikus tempos.",
    // Speech-to-text model for caller transcription. gpt-4o-mini-transcribe is
    // markedly more accurate than whisper-1 for short Estonian utterances, so
    // the deterministic classifier reacts to what the caller actually said.
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    // LLM interpretation assist for the deterministic flow. Used ONLY to resolve
    // intent / callback-number / occupant-count decisions when rule-based
    // matching is uncertain (e.g. garbled STT). Never produces speech.
    assistEnabled: (process.env.IIZI_LLM_ASSIST_ENABLED ?? "true").toLowerCase() !== "false",
    assistModel: process.env.OPENAI_ASSIST_MODEL || "gpt-4o-mini",
    get isConfigured() {
      return !!this.apiKey;
    },
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    get isConfigured() {
      return !!(this.url && (this.serviceRoleKey || this.anonKey));
    },
  },

  // Public URLs
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  publicWsBaseUrl: process.env.PUBLIC_WS_BASE_URL || "",

  /** Shared secret for orchestrator-local admin endpoints (brain-config, etc.) */
  orchestratorAdminSecret: process.env.ORCHESTRATOR_ADMIN_SECRET || "",
};

export function getDeploymentIdentity() {
  return {
    gitSha:
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.SOURCE_COMMIT ||
      process.env.GIT_COMMIT ||
      process.env.COMMIT_SHA ||
      "(unknown)",
    gitBranch: process.env.RAILWAY_GIT_BRANCH || "(unknown)",
    railwayDeploymentId:
      process.env.RAILWAY_DEPLOYMENT_ID ||
      process.env.RAILWAY_REPLICA_ID ||
      "(unknown)",
    railwayServiceName: process.env.RAILWAY_SERVICE_NAME || "(unknown)",
    railwayProjectName: process.env.RAILWAY_PROJECT_NAME || "(unknown)",
    nodeEnv: config.nodeEnv,
    realtimeModel: config.openai.realtimeModel,
    publicBaseUrl: config.publicBaseUrl || "(none)",
    publicWsBaseUrl: config.publicWsBaseUrl || "(none)",
    expectedTwilioVoiceWebhook: config.publicBaseUrl ? `${config.publicBaseUrl}/twilio/voice` : "(missing PUBLIC_BASE_URL)",
    expectedTwilioStreamUrl: (config.publicWsBaseUrl || config.publicBaseUrl.replace("https://", "wss://"))
      ? `${config.publicWsBaseUrl || config.publicBaseUrl.replace("https://", "wss://")}/twilio/stream`
      : "(missing PUBLIC_WS_BASE_URL/PUBLIC_BASE_URL)",
  };
}
