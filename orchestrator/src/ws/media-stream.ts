import WebSocket from "ws";
import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { config, getDeploymentIdentity } from "../config.js";
import {
  fetchAgentConfig,
  fetchAgentByPhoneNumber,
  fetchFirstActiveAgent,
  upsertCall,
  updateCall,
} from "../supabase.js";

// Singleton supabase client for realtime subscriptions (uses anon key — RLS allows authenticated SELECT,
// but for realtime on sms_messages we'll publish to anon role via the table's REPLICA IDENTITY FULL setup).
let supabaseRealtime: SupabaseClient | null = null;
function getSupabaseRealtime(): SupabaseClient | null {
  if (supabaseRealtime) return supabaseRealtime;
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  supabaseRealtime = createClient(config.supabase.url.replace(/\/+$/, ""), config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseRealtime;
}

// Persist an SMS row to the database via the call-write edge function pattern.
// Uses a direct REST insert with anon key (RLS allows anon INSERT on sms_messages).
async function persistSmsMessage(row: {
  call_id: string | null;
  agent_id: string | null;
  template_name: string | null;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string;
  twilio_sid: string | null;
  status: string;
}): Promise<void> {
  if (!config.supabase.url || !config.supabase.anonKey) return;
  try {
    const url = `${config.supabase.url.replace(/\/+$/, "")}/rest/v1/sms_messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.supabase.anonKey,
        Authorization: `Bearer ${config.supabase.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.error(`[persistSmsMessage] HTTP ${res.status}`, await res.text());
    }
  } catch (err) {
    console.error(`[persistSmsMessage] error:`, err);
  }
}

// Post-call analysis via edge function
async function runPostCallAnalysis(callId: string, transcript: string, analysisPrompt: string) {
  if (!config.supabase.url || !config.supabase.anonKey) return;
  try {
    const url = `${config.supabase.url.replace(/\/+$/, "")}/functions/v1/ai-completion`;
    const systemMsg = analysisPrompt || "Analyze this call transcript. Provide a brief summary of the conversation, the outcome, and any action items. IMPORTANT: Detect the language used in the transcript (Estonian, Russian, or English) and write your entire analysis in that same language. Do not mix languages.";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.supabase.anonKey}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: transcript },
        ],
        model: "google/gemini-2.5-flash",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const summary = data?.choices?.[0]?.message?.content || data?.content || null;
      if (summary && typeof summary === "string") {
        await updateCall(callId, { summary });
        console.log(`[MediaStream] Post-call analysis saved (callId=${callId})`);
      }
    } else {
      console.error(`[MediaStream] Analysis failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[MediaStream] Analysis error:`, err);
  }
}

// CRM lookup via edge function — used by inbound bot to identify caller / look up vehicle by reg_no
async function crmLookup(params: { phone_number?: string; reg_no?: string; description?: string }): Promise<any | null> {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  try {
    const url = `${config.supabase.url.replace(/\/+$/, "")}/functions/v1/crm-lookup`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.supabase.anonKey}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      console.error(`[crmLookup] HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data?.vehicle || null;
  } catch (err) {
    console.error(`[crmLookup] error:`, err);
    return null;
  }
}

// Send SMS via Twilio REST API. Returns true on success.
async function sendSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string; status?: string; errorCode?: number | string }> {
  console.log(`[sendSms] >>> attempt to=${to} from=${config.twilio.fromNumber || "(missing)"} bodyLen=${body?.length || 0} bodyPreview="${(body || "").slice(0, 60)}"`);
  if (!config.twilio.isConfigured) {
    console.error(`[sendSms] FAIL: Twilio not configured (accountSid set? ${!!config.twilio.accountSid}, authToken set? ${!!config.twilio.authToken})`);
    return { ok: false, error: "Twilio not configured" };
  }
  if (!to || !body) {
    console.error(`[sendSms] FAIL: missing fields to="${to}" bodyLen=${body?.length || 0}`);
    return { ok: false, error: "Missing 'to' or 'body'" };
  }
  if (!config.twilio.fromNumber) {
    console.error(`[sendSms] FAIL: TWILIO_FROM_NUMBER not configured`);
    return { ok: false, error: "TWILIO_FROM_NUMBER not configured" };
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
    const authHeader = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");
    // Twilio sometimes false-flags repeated test traffic with error 30453.
    // riskCheck: "disable" is used here to prevent false-positive blocking for this SMS flow.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: config.twilio.fromNumber,
        Body: body.slice(0, 1600),
        StatusCallback: `${config.publicBaseUrl}/twilio/sms-status`,
        RiskCheck: "disable",
      }).toString(),
    });
    const data: any = await res.json().catch(() => ({}));
    console.log(`[sendSms] Twilio HTTP ${res.status} response:`, JSON.stringify({
      sid: data?.sid,
      status: data?.status,
      error_code: data?.error_code,
      error_message: data?.error_message,
      to: data?.to,
      from: data?.from,
      num_segments: data?.num_segments,
      price: data?.price,
      message: data?.message,
      code: data?.code,
      more_info: data?.more_info,
    }));
    if (!res.ok) {
      console.error(`[sendSms] FAIL HTTP ${res.status} code=${data?.code} msg=${data?.message} more_info=${data?.more_info}`);
      return { ok: false, error: `${data?.message || `HTTP ${res.status}`}${data?.code ? ` (code ${data.code})` : ""}${data?.more_info ? ` ${data.more_info}` : ""}` };
    }
    // Twilio returns 201 even if the message will fail later (e.g. status="failed" or has error_code).
    // Treat any of those as a real failure so the AI doesn't claim success.
    if (data?.error_code || data?.status === "failed" || data?.status === "undelivered") {
      console.error(`[sendSms] FAIL Twilio accepted but flagged status="${data?.status}" error_code=${data?.error_code} error_message=${data?.error_message}`);
      return { ok: false, sid: data?.sid, status: data?.status, errorCode: data?.error_code, error: data?.error_message || `Twilio status ${data?.status}` };
    }
    console.log(`[sendSms] OK sid=${data?.sid} status=${data?.status}`);
    return { ok: true, sid: data?.sid, status: data?.status };
  } catch (err: any) {
    console.error(`[sendSms] EXCEPTION:`, err);
    return { ok: false, error: err?.message || "send failed" };
  }
}

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

const DEFAULT_INSTRUCTIONS = `You are a professional AI phone agent. Follow these rules strictly:
1. NEVER go off-topic. Only discuss what your instructions cover.
2. Keep every response to 1-3 short sentences maximum.
3. Do NOT elaborate unless explicitly asked.
4. Do NOT make up information not in your instructions or knowledge base.
5. If unsure, say you will follow up — do not guess.
6. Stay in character at all times. Follow the script exactly.`;

/**
 * Handles a single Twilio Media Stream WebSocket connection.
 * Bridges audio between Twilio (mulaw/8kHz) and OpenAI Realtime API.
 */
export function handleTwilioMediaStream(twilioWs: WebSocket) {
  let openaiWs: WebSocket | null = null;
  let streamSid: string = "";
  let callId: string = "";
  let agentId: string = "";
  let calledNumber: string = "";
  let fromNumber: string = "";
  let callDirection: "inbound" | "outbound" = "outbound";
  let callSid: string = "";
  let campaignId: string = "";
  let callVariables: Record<string, string> = {};

  // Collect transcript turns
  const transcriptLines: string[] = [];
  let callStartTime: Date | null = null;
  let agentAnalysisPrompt: string = "";
  let agentKnowledgeBase: any[] = [];
  type SmsMessage = { id?: string; name: string; description?: string; content: string; trigger: "during" | "after"; order?: number };
  let smsMessages: SmsMessage[] = [];
  const smsSentNames = new Set<string>();
  let inboundSmsChannel: RealtimeChannel | null = null;
  let locationConfirmChannel: RealtimeChannel | null = null;
  let resolvedAgentIdRef: string | null = null;
  let substituteVarsRef: (text: string) => string = (t) => t;
  let maxCallDurationMinutes: number = 0;
  let callDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let greetingInProgress = true; // Protect initial greeting from interruption
  let activeResponseId: string | null = null; // Track current response to discard stale audio
  let ignoreAudioUntilNextResponse = false;
  let sessionConfigured = false;
  let pendingInitialResponse = false;
  let initialResponseFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let inboundAudioCooldownUntil = 0;
  let turnDetectionEnableTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAssistantTranscript = "";
  let repeatedAssistantTranscriptCount = 0;
  let pendingRecoveryCooldownMs = 0;
  const DEFAULT_MAX_RESPONSE_OUTPUT_TOKENS = 220;
  // Realtime spoken output can consume tokens much faster than plain text, so give
  // the first greeting a very large budget and then restore the normal cap.
  const INITIAL_GREETING_MAX_RESPONSE_OUTPUT_TOKENS = 4096;
  let greetingTokenLimitRaised = false;
  let configuredMaxResponseOutputTokens = DEFAULT_MAX_RESPONSE_OUTPUT_TOKENS;
  let lastResponseFinishReason: string | null = null;
  let lastResponseOutputTokens: number | null = null;
  // Tools are deferred: we do NOT expose them during the greeting so the model
  // cannot auto-fire end_call / lookup_vehicle before saying hello. The full
  // toolset is attached via session.update right after greeting playback ends.
  let pendingToolsForActivation: any[] = [];
  let toolsActivated = false;

  // Anti-barge-in: when true, don't forward user audio to OpenAI while AI is speaking
  let antiBargeinEnabled = false;
  let aiIsSpeaking = false; // Track whether AI is currently outputting audio or Twilio is still playing it
  // Guardrails against premature end_call right after greeting:
  // 1. We require at least one real user utterance before honoring end_call.
  // 2. We require a minimum elapsed time since greeting completion.
  let greetingCompletedAt: number | null = null;
  let userUtteranceCount = 0;
  const MIN_MS_AFTER_GREETING_BEFORE_END_CALL = 12_000;
  let responsePlaybackMarkName: string | null = null;
  let responseHasAudio = false;
  let responseAudioDone = false;
  let responseDoneReceived = false;
  let responseAudioDeltaLogged = false;
  let markFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Diagnostic counters (A–E from runbook) ----
  // A. Twilio inbound caller audio
  let twilioInboundFrames = 0;
  let twilioInboundFramesDropGreeting = 0;
  let twilioInboundFramesDropCooldown = 0;
  let twilioInboundFramesDropAntiBargein = 0;
  let twilioInboundFramesForwarded = 0;
  let twilioInboundFramesAfterGreeting = 0;
  let firstInboundAudioAfterGreetingLogged = false;
  // B. OpenAI session
  let openaiSessionCreatedAt: number | null = null;
  let openaiSessionUpdatedAt: number | null = null;
  // C. User turn detection
  let speechStartedCount = 0;
  let speechStoppedCount = 0;
  let bufferCommittedCount = 0;
  let userTranscriptCount = 0;
  // D. Assistant response creation
  let responseCreateSentCount = 0;
  let userResponseCreateSentCount = 0;
  let responseCreatedCount = 0;
  let userResponseCreatedCount = 0;
  let responseDoneCount = 0;
  let responseErrorCount = 0;
  let pendingUserResponseTimer: ReturnType<typeof setTimeout> | null = null;
  let callerSpeechWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingUserResponseReason: string | null = null;
  let pendingUserResponseAttempts = 0;
  let pendingUserResponseTranscript: string | null = null;
  let inboundTranscriptFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let inboundTranscriptFallbackSeq = 0;
  let latestCompletedInboundTranscript: { seq: number; text: string; at: number } | null = null;
  let inboundNoAudioTimer: ReturnType<typeof setTimeout> | null = null;
  let responseDoneFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let inboundRecoveryAttemptSeq = 0;
  let inboundRecoveryAttemptsForSeq = 0;
  // E. Assistant audio back to Twilio
  let assistantAudioDeltaCount = 0;
  let assistantOutputAudioDeltaCount = 0;
  let firstAssistantAudioDeltaAt: string | null = null;
  let totalAssistantAudioBytes = 0;
  let userAssistantAudioDeltaCount = 0;
  let userAssistantAudioBytes = 0;
  let twilioOutboundFrames = 0;
  let userTwilioOutboundFrames = 0;
  let firstTwilioOutboundAt: string | null = null;
  let twilioOutboundSendErrors = 0;
  let diagnosticSnapshotTimer: ReturnType<typeof setInterval> | null = null;
  let twilioStartReceived = false;
  let twilioStopReceived = false;
  let twilioGreetingMarkReceived = false;
  let firstCallerMediaAfterGreetingAt: string | null = null;
  let conversationItemCreatedCount = 0;
  let lastSessionConfigSent: Record<string, unknown> | null = null;
  let loadedAgentName = "(none)";
  let bridgeSelfTest = "";
  let callFinalized = false;
  let lastResponseCreateReason = "(none)";
  let activeResponseReason = "(none)";
  let activeResponseInboundTranscriptSeq = 0;
  let activeResponseTwilioChunks = 0;
  let activeResponseTwilioBytes = 0;

  const diagState = () =>
    `state{greetingPlaying=${greetingInProgress},greetingCompletedAt=${greetingCompletedAt ? new Date(greetingCompletedAt).toISOString() : "null"},assistantSpeaking=${aiIsSpeaking},activeResponse=${activeResponseId || "none"},pendingUserTurn=${pendingUserResponseReason || "none"},userUtteranceCount=${userUtteranceCount},openaiWs.readyState=${openaiWs?.readyState ?? "null"},twilioWs.readyState=${twilioWs.readyState}}`;

  const logCallDeploymentIdentity = () => {
    const d = getDeploymentIdentity();
    console.log(`[Diag-Deploy] callId=${callId} gitSha=${d.gitSha} railwayDeploymentId=${d.railwayDeploymentId} NODE_ENV=${d.nodeEnv} realtimeModel=${d.realtimeModel}`);
    console.log(`[Diag-Deploy] callId=${callId} twilioVoiceWebhook=${d.expectedTwilioVoiceWebhook} expectedPublicBaseUrl=${d.publicBaseUrl} expectedStreamUrl=${d.expectedTwilioStreamUrl}`);
  };

  const diagnoseBreakPoint = () => {
    if (twilioInboundFramesAfterGreeting === 0) return "Twilio inbound media after greeting is 0: Twilio stream/greeting mark/gating is broken.";
    if (speechStartedCount === 0 && userTranscriptCount === 0 && bufferCommittedCount === 0) return "Twilio inbound media exists but no OpenAI speech_started/transcript/commit: audio forwarding or Realtime input format is broken.";
    if ((userTranscriptCount > 0 || bufferCommittedCount > 0) && responseCreateSentCount === 0) return "OpenAI transcript/commit exists but no response.create: response triggering logic is broken.";
    if (responseCreateSentCount > 0 && responseCreatedCount === 0) return "response.create was sent but no response.created: OpenAI session/model/config/error is broken.";
    if (responseCreatedCount > 0 && assistantAudioDeltaCount + assistantOutputAudioDeltaCount === 0) return "response.created exists but no audio delta: session output modality/audio config is broken.";
    if (assistantAudioDeltaCount + assistantOutputAudioDeltaCount > 0 && twilioOutboundFrames === 0) return "audio delta exists but no Twilio outbound media: outbound forwarding/conversion is broken.";
    if (twilioOutboundFrames > 0) return "Twilio outbound media exists; if caller hears nothing, codec/payload format or Twilio playback path is broken.";
    return "No single break point identified; inspect preceding counters/events.";
  };

  const sendTwilioBridgeSelfTestTone = (reason: string) => {
    if (bridgeSelfTest !== "twilio-outbound") return;
    if (!streamSid || twilioWs.readyState !== WebSocket.OPEN) {
      console.warn(`[Diag-TestB] skipped reason=${reason} streamSid=${streamSid || "empty"} twilioState=${twilioWs.readyState} (callId=${callId})`);
      return;
    }
    const linearToMuLaw = (sample: number) => {
      const BIAS = 0x84;
      const CLIP = 32635;
      let sign = (sample >> 8) & 0x80;
      if (sign !== 0) sample = -sample;
      if (sample > CLIP) sample = CLIP;
      sample += BIAS;
      let exponent = 7;
      for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) exponent -= 1;
      const mantissa = (sample >> (exponent + 3)) & 0x0f;
      return (~(sign | (exponent << 4) | mantissa)) & 0xff;
    };
    const sampleRate = 8000;
    const toneHz = 880;
    const frames = 60;
    const framePayloads = Array.from({ length: frames }, (_, frameIndex) => {
      const frame = Buffer.alloc(160);
      for (let i = 0; i < 160; i += 1) {
        const t = (frameIndex * 160 + i) / sampleRate;
        frame[i] = linearToMuLaw(Math.round(Math.sin(2 * Math.PI * toneHz * t) * 12000));
      }
      return frame.toString("base64");
    });
    console.warn(`[Diag-TestB] sending hardcoded outbound Twilio media tone frames=${frames} reason=${reason} (callId=${callId})`);
    for (const payload of framePayloads) {
      try {
        twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload } }));
        twilioOutboundFrames += 1;
        if (!firstTwilioOutboundAt) firstTwilioOutboundAt = new Date().toISOString();
      } catch (sendErr) {
        twilioOutboundSendErrors += 1;
        console.error(`[Diag-TestB] Twilio outbound self-test send error (callId=${callId}, twilioState=${twilioWs.readyState}):`, sendErr);
      }
    }
  };

  const clearMarkFallback = () => {
    if (markFallbackTimer) {
      clearTimeout(markFallbackTimer);
      markFallbackTimer = null;
    }
  };

  const clearTurnDetectionEnableTimer = () => {
    if (turnDetectionEnableTimer) {
      clearTimeout(turnDetectionEnableTimer);
      turnDetectionEnableTimer = null;
    }
  };

  const clearPendingUserResponseTimer = () => {
    if (pendingUserResponseTimer) {
      clearTimeout(pendingUserResponseTimer);
      pendingUserResponseTimer = null;
    }
  };

  const clearInboundTranscriptFallbackTimer = () => {
    if (inboundTranscriptFallbackTimer) {
      clearTimeout(inboundTranscriptFallbackTimer);
      inboundTranscriptFallbackTimer = null;
    }
  };

  const clearInboundNoAudioTimer = () => {
    if (inboundNoAudioTimer) {
      clearTimeout(inboundNoAudioTimer);
      inboundNoAudioTimer = null;
    }
  };

  const clearResponseDoneFallbackTimer = () => {
    if (responseDoneFallbackTimer) {
      clearTimeout(responseDoneFallbackTimer);
      responseDoneFallbackTimer = null;
    }
  };

  const clearCallerSpeechWatchdog = () => {
    if (callerSpeechWatchdogTimer) {
      clearTimeout(callerSpeechWatchdogTimer);
      callerSpeechWatchdogTimer = null;
    }
  };

  const commitAudioAndCreateResponse = (reason: string, delayMs = 80) => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      console.warn(`[Diag] audio commit skipped reason=${reason} skip=openai_ws_not_open openaiState=${openaiWs?.readyState ?? "null"} (callId=${callId})`);
      return;
    }
    console.warn(`[Diag] input_audio_buffer.commit sent reason=${reason} (callId=${callId})`);
    openaiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    scheduleUserResponseCreate(reason, delayMs);
  };

  const armCallerSpeechWatchdog = (reason: string, timeoutMs = 2600) => {
    clearCallerSpeechWatchdog();
    callerSpeechWatchdogTimer = setTimeout(() => {
      callerSpeechWatchdogTimer = null;
      if (activeResponseId || greetingInProgress) return;
      console.warn(`[Diag] caller speech watchdog fired reason=${reason}; forcing commit + response.create (callId=${callId})`);
      commitAudioAndCreateResponse(`watchdog-${reason}`, 120);
    }, timeoutMs);
  };

  const sendResponseCreate = (reason: string, response?: Record<string, unknown>) => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      console.warn(`[Diag] response.create skipped reason=${reason} skip=openai_ws_not_open openaiState=${openaiWs?.readyState ?? "null"} activeResponseBefore=${activeResponseId || "none"} (callId=${callId})`);
      return false;
    }
    if (activeResponseId) {
      console.warn(`[Diag] response.create skipped reason=${reason} skip=active_response activeResponseBefore=${activeResponseId} (callId=${callId})`);
      return false;
    }
    responseCreateSentCount += 1;
    if (reason !== "initial-greeting") userResponseCreateSentCount += 1;
    lastResponseCreateReason = reason;
    console.log(`[Diag] response.create sent #${responseCreateSentCount} reason=${reason} activeResponseBefore=${activeResponseId || "none"} (callId=${callId})`);
    openaiWs.send(JSON.stringify(response ? { type: "response.create", response } : { type: "response.create" }));
    return true;
  };

  const scheduleUserResponseCreate = (reason: string, delayMs: number, transcript?: string) => {
    const cleanTranscript = typeof transcript === "string" ? transcript.trim() : "";
    if (cleanTranscript) pendingUserResponseTranscript = cleanTranscript;
    if (pendingUserResponseTimer) {
      if (cleanTranscript) {
        clearPendingUserResponseTimer();
        pendingUserResponseReason = reason;
        pendingUserResponseAttempts = 0;
      } else {
      console.log(`[Diag] response.create schedule skipped reason=${reason} skip=already_pending pendingReason=${pendingUserResponseReason || "none"} activeResponse=${activeResponseId || "none"} (callId=${callId})`);
      return;
      }
    }
    pendingUserResponseReason = pendingUserResponseReason || reason;
    pendingUserResponseTimer = setTimeout(() => {
      pendingUserResponseTimer = null;
      if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;

      const cooldownLeftMs = Math.max(0, inboundAudioCooldownUntil - Date.now());
      if (activeResponseId || greetingInProgress || cooldownLeftMs > 0) {
        pendingUserResponseAttempts += 1;
        if (pendingUserResponseAttempts <= 120) {
          const waitMs = Math.max(150, Math.min(500, cooldownLeftMs || 250));
          if (pendingUserResponseAttempts === 1 || pendingUserResponseAttempts % 10 === 0) {
            console.warn(`[Diag] Deferring response.create after ${pendingUserResponseReason} — activeResponse=${activeResponseId || "none"} greeting=${greetingInProgress} cooldownLeftMs=${cooldownLeftMs} attempt=${pendingUserResponseAttempts} (callId=${callId})`);
          }
          scheduleUserResponseCreate(pendingUserResponseReason || reason, waitMs);
        } else {
          console.error(`[Diag] Gave up forcing assistant response after ${pendingUserResponseReason} because previous response never cleared (callId=${callId})`);
          pendingUserResponseReason = null;
          pendingUserResponseTranscript = null;
          pendingUserResponseAttempts = 0;
        }
        return;
      }

      const finalReason = pendingUserResponseReason || reason;
      pendingUserResponseReason = null;
      pendingUserResponseTranscript = null;
      pendingUserResponseAttempts = 0;
      console.warn(`[Diag] No assistant response after ${finalReason}; sending single response.create (callId=${callId})`);
      sendResponseCreate(finalReason, { modalities: ["text", "audio"] });
    }, delayMs);
  };

  const normalizeTranscript = (txt: string) =>
    txt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const startInboundAudioCooldown = (ms: number, reason: string) => {
    inboundAudioCooldownUntil = Math.max(inboundAudioCooldownUntil, Date.now() + ms);
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    }
    console.log(`[MediaStream] Inbound audio cooldown ${ms}ms after ${reason} (callId=${callId})`);
  };

  const injectInboundTranscriptAsUserText = (transcript: string, reason: string, seq = latestCompletedInboundTranscript?.seq || 0) => {
    const clean = transcript.trim();
    if (!clean || callDirection !== "inbound" || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
    openaiWs.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: clean }],
      },
    }));
    console.warn(`[Diag-InboundTurn] transcript.injected seq=${seq} reason=${reason} text="${clean.slice(0, 160)}" (callId=${callId})`);
  };

  const triggerInboundTranscriptRecovery = (reason: string, failedResponseId?: string | null) => {
    if (callDirection !== "inbound" || greetingInProgress) return;
    if (!latestCompletedInboundTranscript?.text) {
      console.warn(`[Diag-InboundTurn] recovery skipped reason=${reason} skip=no_transcript responseId=${failedResponseId || "none"} (callId=${callId})`);
      return;
    }
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      console.warn(`[Diag-InboundTurn] recovery skipped reason=${reason} skip=openai_ws_not_open responseId=${failedResponseId || "none"} openaiState=${openaiWs?.readyState ?? "null"} (callId=${callId})`);
      return;
    }
    if (inboundRecoveryAttemptSeq !== latestCompletedInboundTranscript.seq) {
      inboundRecoveryAttemptSeq = latestCompletedInboundTranscript.seq;
      inboundRecoveryAttemptsForSeq = 0;
    }
    inboundRecoveryAttemptsForSeq += 1;
    if (inboundRecoveryAttemptsForSeq > 2) {
      console.error(`[Diag-InboundTurn] recovery abandoned reason=${reason} seq=${latestCompletedInboundTranscript.seq} attempts=${inboundRecoveryAttemptsForSeq} responseId=${failedResponseId || "none"} text="${latestCompletedInboundTranscript.text.slice(0, 160)}" (callId=${callId})`);
      return;
    }
    console.warn(`[Diag-InboundTurn] recovery triggered reason=${reason} seq=${latestCompletedInboundTranscript.seq} failedResponseId=${failedResponseId || "none"} text="${latestCompletedInboundTranscript.text.slice(0, 160)}" attempts=${inboundRecoveryAttemptsForSeq} (callId=${callId})`);
    const shouldCancelActiveResponse = Boolean(failedResponseId && activeResponseId === failedResponseId && !responseDoneReceived);
    if (shouldCancelActiveResponse) {
      try {
        openaiWs.send(JSON.stringify({ type: "response.cancel" }));
        console.warn(`[Diag-InboundTurn] response.cancel sent for failed no-audio responseId=${failedResponseId} seq=${latestCompletedInboundTranscript.seq} (callId=${callId})`);
      } catch (err) {
        console.error(`[Diag-InboundTurn] response.cancel failed responseId=${failedResponseId} (callId=${callId}):`, err);
      }
    }
    clearInboundTranscriptFallbackTimer();
    clearInboundNoAudioTimer();
    clearResponseDoneFallbackTimer();
    clearMarkFallback();
    activeResponseId = null;
    responsePlaybackMarkName = null;
    responseHasAudio = false;
    responseAudioDone = false;
    responseDoneReceived = false;
    responseAudioDeltaLogged = false;
    activeResponseTwilioChunks = 0;
    activeResponseTwilioBytes = 0;
    aiIsSpeaking = false;
    ignoreAudioUntilNextResponse = false;
    const sendRecoveryResponse = () => {
      if (!latestCompletedInboundTranscript?.text || !openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
      injectInboundTranscriptAsUserText(latestCompletedInboundTranscript.text, reason, latestCompletedInboundTranscript.seq);
      lastResponseCreateReason = reason;
      console.warn(`[Diag-InboundTurn] fallback sent seq=${latestCompletedInboundTranscript.seq} reason=${reason} text="${latestCompletedInboundTranscript.text.slice(0, 160)}" (callId=${callId})`);
      sendResponseCreate(reason, { modalities: ["text", "audio"] });
    };
    if (shouldCancelActiveResponse) setTimeout(sendRecoveryResponse, 120);
    else sendRecoveryResponse();
  };

  const armInboundNoAudioTimer = (responseId: string | null, transcriptSeq: number, reason: string, timeoutMs = 1400) => {
    if (callDirection !== "inbound" || greetingInProgress || !responseId) return;
    clearInboundNoAudioTimer();
    inboundNoAudioTimer = setTimeout(() => {
      inboundNoAudioTimer = null;
      if (callDirection !== "inbound" || greetingInProgress) return;
      if (activeResponseId !== responseId) return;
      if (activeResponseTwilioChunks > 0) return;
      console.error(`[Diag-InboundTurn] no-usable-audio timeout reason=${reason} responseId=${responseId} seq=${transcriptSeq} openaiAudio=${responseHasAudio} twilioChunks=${activeResponseTwilioChunks} text="${latestCompletedInboundTranscript?.text?.slice(0, 160) || ""}" (callId=${callId})`);
      triggerInboundTranscriptRecovery(`inbound-no-audio-${reason}`, responseId);
    }, timeoutMs);
    console.log(`[Diag-InboundTurn] no-audio timer armed reason=${reason} responseId=${responseId} seq=${transcriptSeq} timeoutMs=${timeoutMs} (callId=${callId})`);
  };

  const armResponseDoneNoAudioGrace = (responseId: string | null, transcriptSeq: number, reason: string, timeoutMs = 450) => {
    if (callDirection !== "inbound" || greetingInProgress || !responseId) return;
    clearResponseDoneFallbackTimer();
    responseDoneFallbackTimer = setTimeout(() => {
      responseDoneFallbackTimer = null;
      if (callDirection !== "inbound" || greetingInProgress) return;
      if (activeResponseId !== responseId) return;
      if (activeResponseTwilioChunks > 0) {
        maybeCompleteAiTurn(`${reason}-audio-arrived`);
        return;
      }
      console.error(`[Diag-InboundTurn] response.done no-usable-audio grace expired responseId=${responseId} seq=${transcriptSeq} openaiAudio=${responseHasAudio} twilioChunks=${activeResponseTwilioChunks} text="${latestCompletedInboundTranscript?.text?.slice(0, 160) || ""}" (callId=${callId})`);
      triggerInboundTranscriptRecovery("inbound-response-done-no-audio", responseId);
    }, timeoutMs);
    console.warn(`[Diag-InboundTurn] response.done no-audio grace armed responseId=${responseId} seq=${transcriptSeq} timeoutMs=${timeoutMs} (callId=${callId})`);
  };

  const resetResponseState = () => {
    activeResponseId = null;
    responsePlaybackMarkName = null;
    responseHasAudio = false;
    responseAudioDone = false;
    responseDoneReceived = false;
    responseAudioDeltaLogged = false;
    activeResponseInboundTranscriptSeq = 0;
    activeResponseTwilioChunks = 0;
    activeResponseTwilioBytes = 0;
    clearMarkFallback();
    clearInboundTranscriptFallbackTimer();
    clearInboundNoAudioTimer();
    clearResponseDoneFallbackTimer();
  };

  const enableTurnDetection = () => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
    // Flush any audio that accumulated during greeting playback (echo, line noise)
    // BEFORE enabling VAD, so it doesn't immediately fire a false speech_started.
    openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    const sessionPatch: any = {
      turn_detection: {
        type: "server_vad",
        threshold: 0.6,             // Slightly less strict so quieter callers still trigger
        prefix_padding_ms: 400,
        silence_duration_ms: 700,   // Faster end-of-turn detection
        create_response: true,
        interrupt_response: true,   // Allow caller to barge in on assistant audio
      },
    };
    // Activate tools NOW (post-greeting). They were withheld during the greeting
    // so the model couldn't immediately call end_call or lookup_vehicle.
    if (!toolsActivated && pendingToolsForActivation.length > 0) {
      sessionPatch.tools = pendingToolsForActivation;
      toolsActivated = true;
      console.log(`[MediaStream] Activating ${pendingToolsForActivation.length} tools post-greeting (callId=${callId})`);
    }
    console.log(`[Diag-OpenAI-Config] callId=${callId} direction=${callDirection} session.update patch=${JSON.stringify({ turn_detection: sessionPatch.turn_detection, tools_count: Array.isArray(sessionPatch.tools) ? sessionPatch.tools.length : 0 })}`);
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: sessionPatch,
    }));
  };

  const maybeCompleteAiTurn = (source: string) => {
    if (!responseDoneReceived) return;
    if (responseHasAudio && !responseAudioDone) return;
    if (responsePlaybackMarkName) return;

    if (greetingTokenLimitRaised) {
      // Greeting playback finished. Safely lower the per-response cap to the configured value
      // for the rest of the call — UNLESS the greeting itself hit the cap (truncated),
      // because lowering it further would just clip subsequent answers too.
      if (lastResponseFinishReason === "max_output_tokens") {
        console.log(`[MediaStream] Greeting hit max_output_tokens — keeping budget at ${INITIAL_GREETING_MAX_RESPONSE_OUTPUT_TOKENS} for safety (callId=${callId})`);
      } else if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        try {
          openaiWs.send(JSON.stringify({
            type: "session.update",
            session: { max_response_output_tokens: configuredMaxResponseOutputTokens },
          }));
          console.log(`[MediaStream] Greeting done — lowered max_response_output_tokens to ${configuredMaxResponseOutputTokens} (callId=${callId})`);
        } catch (err) {
          console.warn(`[MediaStream] Failed to lower max_response_output_tokens:`, err);
        }
      }
      greetingTokenLimitRaised = false;
    }

    const completedResponseId = activeResponseId;
    // After the GREETING specifically, use a tiny cooldown so we don't drop the
    // caller's immediate reply ("tere" / "mul oli avarii"). Echo risk is minimal
    // because the greeting just finished playing and Twilio's mark confirmed it.
    // After normal AI turns we keep the longer cooldown to avoid echo loops.
    const defaultCooldownMs = greetingInProgress ? 150 : 1200;
    const recoveryCooldownMs = pendingRecoveryCooldownMs || defaultCooldownMs;
    pendingRecoveryCooldownMs = 0;

    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;
    startInboundAudioCooldown(recoveryCooldownMs, source);
    if (!greetingInProgress && pendingUserResponseReason) {
      console.log(`[Diag] AI turn completed while user response pending (${pendingUserResponseReason}); scheduling response after cooldown (callId=${callId})`);
      scheduleUserResponseCreate(pendingUserResponseReason, recoveryCooldownMs + 150);
    }

    if (greetingInProgress) {
      greetingInProgress = false;
      greetingCompletedAt = Date.now();
      console.log(`[MediaStream] Greeting playback complete via ${source}, enabling VAD after ${recoveryCooldownMs}ms cooldown (callId=${callId}, responseId=${completedResponseId})`);
      clearTurnDetectionEnableTimer();
      turnDetectionEnableTimer = setTimeout(() => {
        turnDetectionEnableTimer = null;
        enableTurnDetection();
      }, recoveryCooldownMs);
      return;
    }

    console.log(`[MediaStream] AI playback complete via ${source} (callId=${callId}, responseId=${completedResponseId})`);
  };

  // Connect to OpenAI Realtime API with agent-specific config
  const connectToOpenAI = async () => {
    if (!config.openai.isConfigured) {
      console.error("[MediaStream] OpenAI not configured, cannot bridge");
      twilioWs.close();
      return;
    }

    // Fetch agent configuration
    let instructions = DEFAULT_INSTRUCTIONS;
    let greeting = "";
    let voice = "alloy";
    let agentConfig = null;
    let agentTools: string[] = [];
    let agentTemperature = 0.6;

    if (agentId && agentId !== "default") {
      agentConfig = await fetchAgentConfig(agentId);
    }
    if (!agentConfig && calledNumber) {
      console.log(`[MediaStream] No agent by ID, trying phone lookup: ${calledNumber} dir=${callDirection} (callId=${callId})`);
      agentConfig = await fetchAgentByPhoneNumber(calledNumber, callDirection);
    }
    if (!agentConfig) {
      console.log(`[MediaStream] No agent found, falling back to first active agent dir=${callDirection} (callId=${callId})`);
      agentConfig = await fetchFirstActiveAgent(callDirection);
    }

    if (agentConfig) {
      loadedAgentName = agentConfig.name || "(unnamed)";
      console.log(`[MediaStream] Loaded agent config: "${agentConfig.name}" (callId=${callId})`);
      console.log(`[Diag-Agent] callId=${callId} loadedAgentId=${(agentConfig as any).id || agentId || "(none)"} loadedAgentName="${loadedAgentName}" requestedAgentId=${agentId || "(none)"}`);
      if (agentConfig.system_prompt) instructions = agentConfig.system_prompt;
      if (agentConfig.greeting) greeting = agentConfig.greeting;
      if (agentConfig.voice) voice = agentConfig.voice;
      if (agentConfig.tools) agentTools = agentConfig.tools;
      if (agentConfig.analysis_prompt) agentAnalysisPrompt = agentConfig.analysis_prompt;
      if (agentConfig.knowledge_base) agentKnowledgeBase = agentConfig.knowledge_base as any[];
      if (agentConfig.settings) {
        const settings = agentConfig.settings as Record<string, unknown>;
        maxCallDurationMinutes = (settings.max_call_duration as number) || 0;
        if (typeof settings.temperature === "number") {
          agentTemperature = settings.temperature;
        }
        // Per-response token cap for normal turns (greeting still uses INITIAL_GREETING_MAX_RESPONSE_OUTPUT_TOKENS)
        const rawCap = (settings as any).response_token_cap;
        if (typeof rawCap === "number" && Number.isFinite(rawCap) && rawCap >= 50 && rawCap <= 4096) {
          configuredMaxResponseOutputTokens = Math.round(rawCap);
        }
        // Read uninterruptible greeting setting (default true)
        if (settings.uninterruptible_greeting === false) {
          greetingInProgress = false; // Allow interruption from the start
        }
        // Read anti-barge-in setting (default false)
        if (settings.anti_barge_in === true) {
          antiBargeinEnabled = true;
          console.log(`[MediaStream] Anti-barge-in enabled (callId=${callId})`);
        }
        // SMS settings — new schema: array of named templates with explicit triggers.
        // Backward-compat: if `sms_messages` is missing but `sms_template` exists, migrate inline.
        if (Array.isArray((settings as any).sms_messages)) {
          smsMessages = ((settings as any).sms_messages as any[])
            .filter((m) => m && typeof m.content === "string" && m.content.trim())
            .map((m, idx): SmsMessage => ({
              id: m.id,
              name: (m.name || `sms_${idx + 1}`).toString().trim(),
              description: typeof m.description === "string" ? m.description.trim() : "",
              content: m.content,
              trigger: m.trigger === "after" ? "after" : "during",
              order: typeof m.order === "number" ? m.order : idx,
            }))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        } else if (typeof (settings as any).sms_template === "string" && (settings as any).sms_template.trim()) {
          const legacyDuring = (settings as any).sms_during_call === true;
          const legacyAfter = (settings as any).sms_after_call === true;
          if (legacyDuring) {
            smsMessages.push({ name: "default", description: "", content: (settings as any).sms_template, trigger: "during", order: 0 });
          }
          if (legacyAfter) {
            smsMessages.push({ name: "default", description: "", content: (settings as any).sms_template, trigger: "after", order: 1 });
          }
        }
      }
    } else {
      console.warn(`[MediaStream] No agents found at all, using defaults (callId=${callId})`);
    }

    // Inbound CRM prefetch: identify caller by phone number so the agent knows who's calling.
    // Exposed via callVariables so the system prompt can reference {{caller_name}}, {{caller_reg_no}}, etc.
    if (callDirection === "inbound" && fromNumber) {
      const vehicle = await crmLookup({ phone_number: fromNumber });
      if (vehicle) {
        console.log(`[MediaStream] CRM hit for ${fromNumber}: ${vehicle.owner_name} / ${vehicle.reg_no} (callId=${callId})`);
        callVariables.caller_known = "true";
        callVariables.caller_name = vehicle.owner_name || "";
        callVariables.caller_reg_no = vehicle.reg_no || "";
        callVariables.caller_make = vehicle.make || "";
        callVariables.caller_model = vehicle.model || "";
        callVariables.caller_year = vehicle.year_of_built ? String(vehicle.year_of_built) : "";
        callVariables.caller_color = vehicle.color || "";
        callVariables.caller_insurer = vehicle.insurer || "";
        callVariables.caller_cover_type = vehicle.cover_type || "";
        callVariables.caller_cover_status = vehicle.cover_status || "";
      } else {
        console.log(`[MediaStream] CRM miss for ${fromNumber} (callId=${callId})`);
        callVariables.caller_known = "false";
      }
    }

    // Substitute template variables (e.g. {{first_name}}, {{caller_name}})
    const substituteVars = (text: string): string => {
      if (!text) return text;
      return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        const trimmed = varName.trim();
        if (callVariables[trimmed] !== undefined) return callVariables[trimmed];
        return match;
      });
    };

    // Strip orphan {{...}} placeholders that didn't match any variable.
    // Without this, things like "{{eesti keeles suhtle!}}" get read aloud verbatim
    // by TTS, which sounds broken to the caller.
    const stripUnresolvedPlaceholders = (text: string): string => {
      if (!text) return text;
      return text.replace(/\{\{[^}]+\}\}/g, "").replace(/\s{2,}/g, " ").trim();
    };

    // Inject location confirmation link variable so SMS templates can use {{location_link}}.
    // Token = HMAC-SHA256(callId, LOCATION_TOKEN_SECRET) — verified server-side
    // either by Railway /api/location/confirm OR by Lovable edge function `location-confirm`.
    // The MVP uses the Lovable-hosted page (LOCATION_PAGE_BASE_URL); switch to Azure
    // by changing that env var only — the page contract is identical.
    // Resolve the location confirmation page base URL with sane fallbacks.
    // The Railway env was historically set to a placeholder Azure host
    // (`yoursite.z6.web.core.windows.net`) which does not resolve in DNS and
    // breaks the SMS link in production. Detect obvious placeholder values and
    // fall back to the Lovable-hosted page so the link is always usable.
    const PLACEHOLDER_HOST_PATTERNS = [
      /yoursite/i,
      /example\.com/i,
      /your-?domain/i,
      /placeholder/i,
    ];
    const LOVABLE_FALLBACK = "https://app.beyondcode.ai";
    let locationPageBase = (
      process.env.LOCATION_PAGE_BASE_URL ||
      process.env.AZURE_STATIC_BASE_URL ||
      ""
    ).replace(/\/+$/, "");
    if (locationPageBase && PLACEHOLDER_HOST_PATTERNS.some((re) => re.test(locationPageBase))) {
      console.warn(
        `[MediaStream] LOCATION_PAGE_BASE_URL looks like a placeholder (${locationPageBase}), falling back to ${LOVABLE_FALLBACK}`,
      );
      locationPageBase = LOVABLE_FALLBACK;
    }
    if (!locationPageBase) {
      locationPageBase = LOVABLE_FALLBACK;
    }
    // Defensive: strip route segments that some operators accidentally append
    // to LOCATION_PAGE_BASE_URL (e.g. `https://app.example.com/location`),
    // which previously produced double-path URLs like `/location/location?...`
    // and 404 in production. The base URL must be only scheme + host (+ optional
    // sub-path that is NOT one of our route names).
    const ROUTE_SUFFIXES = [
      /\/location\/?$/i,
      /\/form\/?$/i,
      /\/index\.html?$/i,
    ];
    for (const re of ROUTE_SUFFIXES) {
      if (re.test(locationPageBase)) {
        const before = locationPageBase;
        locationPageBase = locationPageBase.replace(re, "");
        console.warn(
          `[MediaStream] LOCATION_PAGE_BASE_URL contained a route suffix (${before}), normalized to ${locationPageBase}`,
        );
      }
    }
    const tokenSecret = process.env.LOCATION_TOKEN_SECRET || "";
    if (callId && tokenSecret) {
      try {
        const crypto = await import("crypto");
        const locToken = crypto.createHmac("sha256", tokenSecret).update(callId).digest("hex");
        // Lovable page lives at /location?caseId=...&token=...
        // Azure static page lives at /index.html?caseId=...&token=...
        // Detect by extension/path: if base ends with a host (no path), use /location.
        const isLovableLike = !locationPageBase.endsWith(".html") && !/\/index$/.test(locationPageBase);
        const path = isLovableLike ? "/location" : "/index.html";
        callVariables.location_link = `${locationPageBase}${path}?caseId=${encodeURIComponent(callId)}&token=${locToken}`;
        console.log(`[MediaStream] location_link built: ${callVariables.location_link}`);
      } catch (err) {
        console.error(`[MediaStream] Failed to build location_link:`, err);
      }
    } else if (callId && !tokenSecret) {
      console.warn(`[MediaStream] LOCATION_TOKEN_SECRET not set — cannot build location_link`);
    }

    // Inject form submission link variable so SMS templates can use {{form_link}}.
    // The form page lets the customer enter their car registration number and a
    // callback phone number. Submitted values land in the same `calls` row
    // (form_registration_number, form_callback_phone_number, form_submitted_at)
    // and are read back to the caller by the AI via the realtime UPDATE
    // subscription further down. Same HMAC token + base URL as the location link.
    if (callId && tokenSecret) {
      try {
        const crypto = await import("crypto");
        const formToken = crypto.createHmac("sha256", tokenSecret).update(callId).digest("hex");
        const isLovableLike = !locationPageBase.endsWith(".html") && !/\/index$/.test(locationPageBase);
        const formPath = isLovableLike ? "/form" : "/form.html";
        callVariables.form_link = `${locationPageBase}${formPath}?caseId=${encodeURIComponent(callId)}&token=${formToken}`;
        console.log(`[MediaStream] form_link built: ${callVariables.form_link}`);
      } catch (err) {
        console.error(`[MediaStream] Failed to build form_link:`, err);
      }
    }

    // Legacy Google Form fallback — only used if GOOGLE_FORM_BASE_URL is configured
    // AND we couldn't build a Lovable form link above. Kept for backwards compat.
    const formBaseUrl = (process.env.GOOGLE_FORM_BASE_URL || "").replace(/\/+$/, "");
    const formCaseEntryId = process.env.GOOGLE_FORM_CASE_ENTRY_ID || "";
    if (callId && formBaseUrl && formCaseEntryId && !callVariables.form_link) {
      try {
        const params = new URLSearchParams({
          usp: "pp_url",
          [formCaseEntryId]: callId,
        });
        callVariables.form_link = `${formBaseUrl}?${params.toString()}`;
      } catch (err) {
        console.error(`[MediaStream] Failed to build google form_link:`, err);
      }
    }

    if (Object.keys(callVariables).length > 0) {
      instructions = substituteVars(instructions);
      greeting = substituteVars(greeting);
      console.log(`[MediaStream] Substituted ${Object.keys(callVariables).length} variables into prompt (callId=${callId})`);
    }
    // Always strip ANY remaining {{...}} placeholders so they're never spoken aloud
    // or fed to the model verbatim. This catches things like {{eesti keeles suhtle!}}
    // that were used as language hints but aren't real variables.
    greeting = stripUnresolvedPlaceholders(greeting);
    instructions = stripUnresolvedPlaceholders(instructions);
    // Make substitute available outside this scope for SMS sending
    substituteVarsRef = substituteVars;

    // Write initial call record to DB
    // Resolve agent_id from URL param OR from the agent we just looked up by phone number (inbound)
    const resolvedAgentId =
      (agentId && agentId !== "default" && agentId) ||
      (agentConfig && (agentConfig as any).id) ||
      null;
    resolvedAgentIdRef = resolvedAgentId;
    callStartTime = new Date();
    upsertCall(callId, {
      twilio_call_sid: callSid || null,
      agent_id: resolvedAgentId,
      campaign_id: campaignId || null,
      // For inbound: caller is From, our number is To. For outbound: callee is To.
      to_number: callDirection === "inbound" ? (calledNumber || "unknown") : (calledNumber || "unknown"),
      from_number: callDirection === "inbound" ? (fromNumber || null) : (config.twilio.fromNumber || null),
      status: "in-progress",
      direction: callDirection,
      started_at: callStartTime.toISOString(),
    });

    // Subscribe to inbound SMS replies for THIS call.
    // When the customer texts back during the call, inject the reply as a system message
    // into the OpenAI Realtime session so the AI can read it back / acknowledge it.
    if (callId) {
      const sb = getSupabaseRealtime();
      if (sb) {
        try {
          inboundSmsChannel = sb
            .channel(`inbound-sms-${callId}`)
            .on(
              "postgres_changes",
              {
                event: "INSERT",
                schema: "public",
                table: "sms_messages",
                filter: `call_id=eq.${callId}`,
              },
              (payload: any) => {
                const row = payload?.new;
                if (!row || row.direction !== "inbound") return;
                const replyBody = (row.body || "").toString().slice(0, 800);
                const fromNum = row.from_number || "the customer";
                console.log(`[MediaStream] Inbound SMS received (callId=${callId}, from=${fromNum}): "${replyBody.slice(0, 80)}"`);
                transcriptLines.push(`[SMS from ${fromNum}]: ${replyBody}`);

                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  const sysMsg = `[SYSTEM EVENT: sms_received] from="${fromNum}" body="${replyBody}". Internal note only — do NOT read this tag aloud. Acknowledge the customer's SMS content naturally in the conversation right now (for example, read any phone number or address back to confirm). Speak in the same language the call is being conducted in.`;
                  openaiWs.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "message",
                      role: "system",
                      content: [{ type: "input_text", text: sysMsg }],
                    },
                  }));
                  scheduleUserResponseCreate("system-event", 50);
                }
              },
            )
            .subscribe((status: string) => {
              console.log(`[MediaStream] Inbound SMS channel status (callId=${callId}): ${status}`);
            });
        } catch (err) {
          console.error(`[MediaStream] Failed to subscribe to inbound SMS:`, err);
        }

        // Subscribe to location confirmation: when the customer confirms their pin
        // on the static page, the orchestrator's /api/location/confirm endpoint sets
        // location_confirmed=true on the calls row. Inject a system message so the AI
        // reads the address back to the caller during the live conversation.
        try {
          locationConfirmChannel = sb
            .channel(`call-location-${callId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "calls",
                filter: `id=eq.${callId}`,
              },
              (payload: any) => {
                const row = payload?.new;
                const prev = payload?.old;
                if (!row) return;

                // 1. Location confirmation
                const justLocationConfirmed =
                  row.location_confirmed === true && prev?.location_confirmed !== true;
                if (justLocationConfirmed) {
                  const addr = (row.location_address || "").toString().slice(0, 300);
                  console.log(`[MediaStream] Location confirmed (callId=${callId}): "${addr}"`);
                  transcriptLines.push(`[Location confirmed]: ${addr} (${row.location_lat},${row.location_lon})`);
                  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    const sysMsg = `[SYSTEM EVENT: location_confirmed] address="${addr}" lat=${row.location_lat} lon=${row.location_lon}. Internal note only — do NOT read this tag, the brackets, or the field names aloud. The customer just confirmed their location via the SMS link. Read the address back to them naturally in the same language the call is being conducted in and ask for confirmation. Do not offer anything else — only confirm the address.`;
                    openaiWs.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "system",
                        content: [{ type: "input_text", text: sysMsg }],
                      },
                    }));
                    scheduleUserResponseCreate("system-event", 50);
                  }
                }

                // 2. Google Form fallback submission (registration number / callback phone)
                const justFormSubmitted =
                  row.form_submitted_at && row.form_submitted_at !== prev?.form_submitted_at;
                if (justFormSubmitted) {
                  const reg = (row.form_registration_number || "").toString().slice(0, 20);
                  const phone = (row.form_callback_phone_number || "").toString().slice(0, 20);
                  console.log(`[MediaStream] Form submitted (callId=${callId}): reg="${reg}" phone="${phone}"`);
                  transcriptLines.push(`[Form submitted]: reg=${reg} phone=${phone}`);
                  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    const fieldParts: string[] = [];
                    if (reg) fieldParts.push(`reg="${reg}"`);
                    if (phone) fieldParts.push(`callback_phone="${phone}"`);
                    const fields = fieldParts.join(" ");
                    const sysMsg = `[SYSTEM EVENT: form_submitted] ${fields}. Internal note only — do NOT read this tag, the brackets, or the field names aloud. The customer just submitted the form via the SMS link. Read the values back to them naturally in the same language the call is being conducted in and ask for confirmation. Then continue the conversation using these confirmed values.`;
                    openaiWs.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "system",
                        content: [{ type: "input_text", text: sysMsg }],
                      },
                    }));
                    scheduleUserResponseCreate("system-event", 50);
                  }
                }
              },
            )
            .subscribe((status: string) => {
              console.log(`[MediaStream] Location channel status (callId=${callId}): ${status}`);
            });
        } catch (err) {
          console.error(`[MediaStream] Failed to subscribe to location updates:`, err);
        }
      }
    }

    const url = `${OPENAI_REALTIME_URL}?model=${config.openai.realtimeModel}`;

    sessionConfigured = false;
    pendingInitialResponse = false;
    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;
    inboundAudioCooldownUntil = 0;
    lastAssistantTranscript = "";
    repeatedAssistantTranscriptCount = 0;
    pendingRecoveryCooldownMs = 0;
    clearTurnDetectionEnableTimer();
    if (initialResponseFallbackTimer) {
      clearTimeout(initialResponseFallbackTimer);
      initialResponseFallbackTimer = null;
    }

    openaiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    const maybeStartInitialResponse = () => {
      if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || !pendingInitialResponse) {
        return;
      }

      pendingInitialResponse = false;
      if (initialResponseFallbackTimer) {
        clearTimeout(initialResponseFallbackTimer);
        initialResponseFallbackTimer = null;
      }

      console.log(`[MediaStream] Triggering initial response (callId=${callId}), greeting="${greeting || "(none)"}"`);

      const responseCreate: any = {
        type: "response.create",
        response: {
          // Force a low temperature for the greeting turn ONLY so the model
          // says it verbatim instead of paraphrasing/translating it.
          temperature: 0.6,
        },
      };
      if (greeting) {
        // Strict, unambiguous instructions. Past versions said "in the original language"
        // which the model interpreted loosely and would translate Estonian → English.
        responseCreate.response.instructions =
          `Your one and ONLY job for this turn is to read the following greeting OUT LOUD, ` +
          `WORD-FOR-WORD, in the EXACT SAME LANGUAGE it is written in. ` +
          `Do NOT translate it. Do NOT paraphrase it. Do NOT add anything before or after it. ` +
          `Do NOT change a single word. Do NOT pronounce any punctuation, brackets, or template syntax. ` +
          `If the greeting is in Estonian, you MUST speak Estonian. If in Finnish, Finnish. If in English, English. ` +
          `\n\nGREETING TO SAY VERBATIM:\n"""\n${greeting}\n"""`;
      }
      sendResponseCreate("initial-greeting", responseCreate.response);

      // Treat the initial response as speaking immediately so anti-barge-in stays active until playback is confirmed done.
      aiIsSpeaking = true;

      if (maxCallDurationMinutes > 0 && !callDurationTimer) {
        const maxMs = maxCallDurationMinutes * 60 * 1000;
        console.log(`[MediaStream] Max call duration: ${maxCallDurationMinutes}m (callId=${callId})`);
        callDurationTimer = setTimeout(() => {
          console.log(`[MediaStream] Max call duration reached, hanging up (callId=${callId})`);
          transcriptLines.push(`[System]: Call ended — max duration (${maxCallDurationMinutes}m) reached`);
          hangUpCall();
        }, maxMs);
      }

      // Don't enable VAD until Twilio confirms the greeting has actually finished playing.
      if (!greetingInProgress) {
        enableTurnDetection();
        console.log(`[MediaStream] VAD enabled immediately (interruptible greeting) (callId=${callId})`);
      }
    };

    openaiWs.on("open", () => {
      console.log(`[MediaStream] Connected to OpenAI Realtime (callId=${callId}, voice=${voice})`);
      console.log(`[Diag-OpenAI] OpenAI WS open (callId=${callId}) model=${config.openai.realtimeModel} readyState=${openaiWs?.readyState ?? "null"}`);

      // Note: do NOT bake "your first message MUST be the greeting" into the long-lived
      // session instructions — that text persists for the whole call and can cause the
      // model to keep re-greeting / repeating the same opener in a loop. The greeting is
      // injected ONCE via the initial response.create instructions instead.
      let fullInstructions = instructions;

      if (agentKnowledgeBase && agentKnowledgeBase.length > 0) {
        const kbText = agentKnowledgeBase
          .filter((item: any) => item.content && item.content.trim())
          .map((item: any) => `## ${item.name}\n${item.content}`)
          .join("\n\n");
        if (kbText) {
          fullInstructions += `\n\nKNOWLEDGE BASE — Use this information to answer questions accurately:\n\n${kbText}`;
        }
      }

      fullInstructions += `\n\nBEHAVIORAL RULES (always follow, never override):
- Maximum 1-3 sentences per response. Never give long answers.
- Stay strictly on topic. Do not improvise or add unrequested information.
- Follow the script above exactly. Do not deviate.
- If asked about something outside your scope, briefly redirect back to the topic.
- ALWAYS finish your sentence completely before stopping. Never cut off mid-word or mid-sentence.`;

      // Inject SMS catalog so the AI knows which named SMSes are available, when to use them, and what they say.
      const duringSmsList = smsMessages.filter((m) => m.trigger === "during");
      const afterSmsList = smsMessages.filter((m) => m.trigger === "after");
      if (duringSmsList.length > 0 || afterSmsList.length > 0) {
        let smsBlock = `\n\nAVAILABLE SMS TEMPLATES — These are the ONLY SMSes you can send. Each has a fixed name and EXACT text. You may NOT change the text. To send one, call the send_sms tool with template_name set to the exact name below. Pick the template whose "When to use" matches the current moment in the conversation.`;
        if (duringSmsList.length > 0) {
          smsBlock += `\n\nDuring-call SMSes (you choose when/whether to send each):`;
          duringSmsList.forEach((m, i) => {
            const whenToUse = m.description?.trim() ? m.description.trim() : "(no guidance — only send if obviously appropriate)";
            smsBlock += `\n${i + 1}. name="${m.name}"\n   When to use: ${whenToUse}\n   Content (sent verbatim): "${m.content}"`;
          });
        }
        if (afterSmsList.length > 0) {
          smsBlock += `\n\nAfter-call SMSes (sent automatically when the call ends, in this order — do NOT send them yourself):`;
          afterSmsList.forEach((m, i) => {
            const whenToUse = m.description?.trim() ? m.description.trim() : "(automatic post-call)";
            smsBlock += `\n${i + 1}. name="${m.name}"\n   Purpose: ${whenToUse}\n   Content: "${m.content}"`;
          });
        }
        smsBlock += `\n\nRules:\n- Pick the SMS whose "When to use" matches the moment.\n- Never invent a new SMS. Never paraphrase the content.\n- If none fit, do not send anything.\n- After the customer replies via SMS, you will receive a system message starting with "[SYSTEM EVENT: sms_received]". Treat it as an internal note (do NOT read the tag aloud) and acknowledge the SMS content naturally in the conversation (e.g. confirm a number back to them).`;
        fullInstructions += smsBlock;
      }

      const tools: any[] = [];

      if (agentTools.includes("end_call")) {
        tools.push({
          type: "function",
          name: "end_call",
          description: "End the current phone call. STRICT RULES: (1) Never call this during or immediately after the greeting. (2) Never call this before the caller has spoken at least one substantive sentence to you. (3) Only call this AFTER the caller has clearly said goodbye (e.g. 'aitäh, head aega', 'tšau', 'bye'), OR the caller explicitly asked to hang up, OR all required intake information has been collected AND you have confirmed the next step with the caller. If you are unsure, do NOT call this — keep the conversation going.",
          parameters: {
            type: "object",
            properties: {
              reason: {
                type: "string",
                description: "Brief reason for ending the call",
              },
            },
            required: ["reason"],
          },
        });
      }

      if (agentTools.includes("lookup_vehicle")) {
        tools.push({
          type: "function",
          name: "lookup_vehicle",
          description: "Look up a vehicle in the CRM. Call this ONLY when the caller has SPOKEN one of the following out loud during the live conversation: (a) a registration plate (e.g. '484DLC'), or (b) a free-text description of the car (make/model/color/year, e.g. 'must BMW 535D 2006'). DO NOT call this just because you know the caller's phone number — the system already attempted a phone-based match before connecting you. DO NOT call this during or immediately after the greeting. DO NOT call this before the caller has actually spoken to you. Returns owner name, vehicle, insurer, cover type/status. If no match, returns found:false.",
          parameters: {
            type: "object",
            properties: {
              reg_no: {
                type: "string",
                description: "Estonian registration plate the caller spoke aloud, e.g. '495BJS'. Strip spaces, uppercase. Pass even if you are not 100% sure — server does fuzzy matching.",
              },
              description: {
                type: "string",
                description: "Free-text vehicle description the caller spoke aloud, in any language (Estonian preferred), e.g. 'must BMW 535D 2006' or 'punane Saab 9-5'. Use when caller describes the car instead of giving the plate.",
              },
            },
          },
        });
      }

      if (duringSmsList.length > 0) {
        const recipientHint = callDirection === "inbound"
          ? "the caller's number is the From number of this call"
          : "the called number is the To number of this call";
        const allowedNames = duringSmsList.map((m) => `"${m.name}"`).join(", ");
        tools.push({
          type: "function",
          name: "send_sms",
          description: `Send one of the pre-configured SMS templates to the other party RIGHT NOW. The recipient is the other party on this call (${recipientHint}) — you do NOT pass a phone number. You also do NOT write the message yourself: pick one of the configured templates by its EXACT name (see AVAILABLE SMS TEMPLATES in your instructions). The server sends the template text VERBATIM. Allowed template_name values: ${allowedNames}. After it sends, briefly confirm to the caller in their language.`,
          parameters: {
            type: "object",
            properties: {
              template_name: {
                type: "string",
                enum: duringSmsList.map((m) => m.name),
                description: "Exact name of the configured SMS template to send. Must match one of the names listed in AVAILABLE SMS TEMPLATES.",
              },
            },
            required: ["template_name"],
          },
        });
      }

      // Clamp temperature to OpenAI Realtime's valid range [0.6, 1.2] — values outside
      // this range can cause the model to emit malformed audio (heard as static/clicks).
      const rawTemp = agentConfig ? agentTemperature : 0.6;
      const sessionTemperature = Math.min(1.2, Math.max(0.6, rawTemp));
      greetingTokenLimitRaised = Boolean(greeting);

      const sessionUpdate: any = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: fullInstructions,
          voice,
          temperature: sessionTemperature,
          // Cap each turn so the model can't ramble or loop on the same sentence forever.
          max_response_output_tokens: greetingTokenLimitRaised
            ? INITIAL_GREETING_MAX_RESPONSE_OUTPUT_TOKENS
            : configuredMaxResponseOutputTokens,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: {
            model: "whisper-1",
            // Lock STT to Estonian — most callers speak ET. Mixed-language whisper
            // mangles plates like 484DLC → 484DLT, which breaks CRM lookups.
            language: "et",
            prompt: "Eesti keelne kõne. Auto registreerimismärgid on kujul kolm numbrit ja kolm tähte, näiteks 484DLC, 495BJS, 606BSB, 130XMS.",
          },
          // Start with VAD disabled — we enable it after the greeting playback is fully complete,
          // or immediately if greetings are allowed to be interruptible.
          turn_detection: null,
        },
      };

      // IMPORTANT: do NOT attach tools yet. Tools are activated only after the
      // greeting playback completes (see enableTurnDetection). This prevents the
      // model from auto-calling end_call / lookup_vehicle before the greeting,
      // which was causing inbound calls to drop with "Thank you, have a great day!".
      pendingToolsForActivation = tools;
      toolsActivated = false;

      pendingInitialResponse = true;
      lastSessionConfigSent = {
        model: config.openai.realtimeModel,
        modalities: sessionUpdate.session.modalities,
        input_audio_format: sessionUpdate.session.input_audio_format,
        output_audio_format: sessionUpdate.session.output_audio_format,
        voice: sessionUpdate.session.voice,
        turn_detection: sessionUpdate.session.turn_detection,
        input_audio_transcription: sessionUpdate.session.input_audio_transcription,
        tools_count: tools.length,
      };
      console.log(`[Diag-OpenAI-Config] callId=${callId} ${JSON.stringify(lastSessionConfigSent)}`);
      openaiWs!.send(JSON.stringify(sessionUpdate));

      initialResponseFallbackTimer = setTimeout(() => {
        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || !pendingInitialResponse) {
          return;
        }
        console.warn(`[MediaStream] session.updated not received in time, using fallback start (callId=${callId})`);
        sessionConfigured = true;
        maybeStartInitialResponse();
      }, 500);
    });

    openaiWs.on("message", async (data) => {
      try {
        const event = JSON.parse(data.toString());

        switch (event.type) {
          case "session.created":
            openaiSessionCreatedAt = Date.now();
            console.log(`[Diag] OpenAI session.created (callId=${callId}) model=${config.openai.realtimeModel}`);
            break;

          case "conversation.item.created":
            conversationItemCreatedCount += 1;
            console.log(`[Diag] conversation.item.created #${conversationItemCreatedCount} itemType=${event.item?.type || "?"} role=${event.item?.role || "?"} (callId=${callId})`);
            break;

          case "session.updated":
            openaiSessionUpdatedAt = Date.now();
            if (!sessionConfigured) {
              sessionConfigured = true;
              console.log(`[Diag] OpenAI session.updated — INITIAL configured (callId=${callId}) modalities=text+audio audioFormat=g711_ulaw`);
              maybeStartInitialResponse();
            } else {
              console.log(`[Diag] OpenAI session.updated — patch applied (callId=${callId})`);
            }
            break;

          case "response.created":
            clearPendingUserResponseTimer();
            responseCreatedCount += 1;
            activeResponseId = event.response?.id || null;
            activeResponseReason = callDirection === "inbound" && !greetingInProgress && lastResponseCreateReason === "initial-greeting"
              ? "inbound-auto-vad"
              : lastResponseCreateReason;
            if (activeResponseReason !== "initial-greeting") userResponseCreatedCount += 1;
            responsePlaybackMarkName = null;
            responseHasAudio = false;
            responseAudioDone = false;
            responseDoneReceived = false;
            responseAudioDeltaLogged = false;
            activeResponseInboundTranscriptSeq = callDirection === "inbound" && !greetingInProgress
              ? latestCompletedInboundTranscript?.seq || inboundTranscriptFallbackSeq
              : 0;
            activeResponseTwilioChunks = 0;
            activeResponseTwilioBytes = 0;
            ignoreAudioUntilNextResponse = false;
            aiIsSpeaking = true;
            lastResponseFinishReason = null;
            lastResponseOutputTokens = null;
            console.log(`[Diag] response.created #${responseCreatedCount} reason=${activeResponseReason} responseId=${activeResponseId} (callId=${callId})`);
            if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
              console.log(`[Diag-InboundTurn] response.created seq=${activeResponseInboundTranscriptSeq} responseId=${activeResponseId} reason=${activeResponseReason} transcript="${latestCompletedInboundTranscript?.text?.slice(0, 160) || ""}" (callId=${callId})`);
              armInboundNoAudioTimer(activeResponseId, activeResponseInboundTranscriptSeq, "response.created");
            }
            break;

          case "response.audio.delta":
          case "response.output_audio.delta": {
            const responseId = event.response_id || activeResponseId || null;
            if (ignoreAudioUntilNextResponse) {
              if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                console.warn(`[Diag-InboundTurn] audio.delta discarded reason=ignoreAudioUntilNextResponse responseId=${responseId || "none"} seq=${activeResponseInboundTranscriptSeq} type=${event.type} (callId=${callId})`);
              }
              break;
            }
            if (!activeResponseId || !responseId || responseId !== activeResponseId) {
              if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                console.warn(`[Diag-InboundTurn] audio.delta discarded reason=response_mismatch active=${activeResponseId || "none"} eventResponse=${responseId || "none"} seq=${activeResponseInboundTranscriptSeq} type=${event.type} (callId=${callId})`);
              }
              break;
            }
            const hasUsableAudioDelta = typeof event.delta === "string" && event.delta.length > 0;
            if (event.type === "response.output_audio.delta") assistantOutputAudioDeltaCount += 1;
            else assistantAudioDeltaCount += 1;
            if (hasUsableAudioDelta) responseHasAudio = true;
            if (callDirection === "inbound" && activeResponseReason !== "initial-greeting" && !responseAudioDeltaLogged && hasUsableAudioDelta) {
              responseAudioDeltaLogged = true;
              console.log(`[Diag-InboundTurn] response.audio.delta first type=${event.type} responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} hasDelta=${!!event.delta} (callId=${callId})`);
            }
            if (streamSid && twilioWs.readyState === WebSocket.OPEN && event.delta) {
              try {
                const raw = Buffer.from(event.delta, "base64");
                if (raw.length === 0) {
                  if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                    console.warn(`[Diag-InboundTurn] audio.delta decoded to zero bytes responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} deltaLen=${event.delta.length} (callId=${callId})`);
                  }
                  break;
                }
                totalAssistantAudioBytes += raw.length;
                if (activeResponseReason !== "initial-greeting") {
                  userAssistantAudioDeltaCount += 1;
                  userAssistantAudioBytes += raw.length;
                }
                if (!firstAssistantAudioDeltaAt) {
                  firstAssistantAudioDeltaAt = new Date().toISOString();
                  console.log(`[Diag] first OpenAI audio delta type=${event.type} bytes=${raw.length} at=${firstAssistantAudioDeltaAt} (callId=${callId})`);
                }
                const FRAME = 160; // 20ms @ 8kHz mu-law
                for (let offset = 0; offset < raw.length; offset += FRAME) {
                  const chunk = raw.subarray(offset, Math.min(offset + FRAME, raw.length));
                  try {
                    twilioWs.send(JSON.stringify({
                      event: "media",
                      streamSid,
                      media: { payload: chunk.toString("base64") },
                    }));
                    twilioOutboundFrames += 1;
                    if (activeResponseReason !== "initial-greeting") userTwilioOutboundFrames += 1;
                    activeResponseTwilioChunks += 1;
                    activeResponseTwilioBytes += chunk.length;
                    if (callDirection === "inbound" && activeResponseReason !== "initial-greeting" && activeResponseTwilioChunks === 1) {
                      clearInboundTranscriptFallbackTimer();
                      clearInboundNoAudioTimer();
                      clearResponseDoneFallbackTimer();
                    }
                    if (callDirection === "inbound" && activeResponseReason !== "initial-greeting" && (activeResponseTwilioChunks <= 3 || activeResponseTwilioChunks % 25 === 0)) {
                      console.log(`[Diag-InboundTurn] twilio.media.forwarded responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} chunk=${activeResponseTwilioChunks} chunkBytes=${chunk.length} responseBytes=${activeResponseTwilioBytes} totalTwilioOut=${twilioOutboundFrames} (callId=${callId})`);
                    }
                    if (!firstTwilioOutboundAt) {
                      firstTwilioOutboundAt = new Date().toISOString();
                      console.log(`[Diag] first outbound media to Twilio at=${firstTwilioOutboundAt} twilioState=${twilioWs.readyState} (callId=${callId})`);
                    }
                  } catch (sendErr) {
                    twilioOutboundSendErrors += 1;
                    console.error(`[Diag] Twilio send error (callId=${callId}, twilioState=${twilioWs.readyState}):`, sendErr);
                  }
                }
              } catch (e) {
                try {
                  twilioWs.send(JSON.stringify({
                    event: "media",
                    streamSid,
                    media: { payload: event.delta },
                  }));
                  twilioOutboundFrames += 1;
                  activeResponseTwilioChunks += 1;
                  activeResponseTwilioBytes += Buffer.byteLength(String(event.delta), "base64");
                  if (callDirection === "inbound" && activeResponseReason !== "initial-greeting" && activeResponseTwilioChunks === 1) {
                    clearInboundTranscriptFallbackTimer();
                    clearInboundNoAudioTimer();
                    clearResponseDoneFallbackTimer();
                  }
                  if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                    console.log(`[Diag-InboundTurn] twilio.media.forwarded fallback responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} chunk=${activeResponseTwilioChunks} responseBytes=${activeResponseTwilioBytes} totalTwilioOut=${twilioOutboundFrames} (callId=${callId})`);
                  }
                  if (!firstTwilioOutboundAt) {
                    firstTwilioOutboundAt = new Date().toISOString();
                    console.log(`[Diag] first outbound media to Twilio at=${firstTwilioOutboundAt} twilioState=${twilioWs.readyState} (callId=${callId})`);
                  }
                } catch (sendErr) {
                  twilioOutboundSendErrors += 1;
                  console.error(`[Diag] Twilio send error (fallback path) (callId=${callId}):`, sendErr);
                }
              }
            } else {
              console.warn(`[Diag] Cannot forward assistant audio: streamSid=${streamSid?"set":"empty"} twilioState=${twilioWs.readyState} hasDelta=${!!event.delta} (callId=${callId})`);
            }
            break;
          }

          case "response.audio_transcript.done": {
            const assistantTranscript = (event.transcript || "").toString();
            console.log(`[MediaStream] AI said (callId=${callId}): ${assistantTranscript}`);
            transcriptLines.push(`[Agent]: ${assistantTranscript}`);
            if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
              console.log(`[Diag-InboundTurn] response.audio_transcript.done seq=${activeResponseInboundTranscriptSeq} responseId=${activeResponseId || "none"} text="${assistantTranscript.slice(0, 160)}" (callId=${callId})`);
              if (activeResponseTwilioChunks > 0) {
                clearInboundTranscriptFallbackTimer();
                clearInboundNoAudioTimer();
                clearResponseDoneFallbackTimer();
              } else if (activeResponseId) {
                console.warn(`[Diag-InboundTurn] transcript-only assistant response detected; keeping no-audio recovery armed responseId=${activeResponseId} seq=${activeResponseInboundTranscriptSeq} openaiAudio=${responseHasAudio} twilioChunks=${activeResponseTwilioChunks} (callId=${callId})`);
                armResponseDoneNoAudioGrace(activeResponseId, activeResponseInboundTranscriptSeq, "response.audio_transcript.done-no-twilio-audio", 350);
              }
            }

            // Detect the model repeating itself (echo loop). If it says effectively the
            // same line twice in a row without the user speaking in between, extend the
            // post-speech cooldown so its own audio can't keep re-triggering it.
            const normalizedAssistantTranscript = normalizeTranscript(assistantTranscript);
            if (normalizedAssistantTranscript) {
              if (normalizedAssistantTranscript === lastAssistantTranscript) {
                repeatedAssistantTranscriptCount += 1;
              } else {
                lastAssistantTranscript = normalizedAssistantTranscript;
                repeatedAssistantTranscriptCount = 1;
              }

              if (repeatedAssistantTranscriptCount >= 2) {
                pendingRecoveryCooldownMs = Math.max(pendingRecoveryCooldownMs, 2500);
                console.warn(`[MediaStream] Detected repeated assistant line x${repeatedAssistantTranscriptCount}, extending echo recovery cooldown (callId=${callId})`);
              }
            }
            break;
          }

          case "conversation.item.input_audio_transcription.completed":
            clearCallerSpeechWatchdog();
            userTranscriptCount += 1;
            console.log(`[Diag] user_transcript #${userTranscriptCount} (callId=${callId}): "${event.transcript}"`);
            transcriptLines.push(`[User]: ${event.transcript}`);
            if (typeof event.transcript === "string" && event.transcript.trim().length > 0) {
              userUtteranceCount += 1;
            }
            // Real user speech resets the repeat counter.
            lastAssistantTranscript = "";
            repeatedAssistantTranscriptCount = 0;
            pendingRecoveryCooldownMs = 0;
            if (callDirection === "inbound") {
              const fallbackSeq = ++inboundTranscriptFallbackSeq;
              const transcriptText = String(event.transcript || "").trim();
              latestCompletedInboundTranscript = { seq: fallbackSeq, text: transcriptText, at: Date.now() };
              inboundRecoveryAttemptSeq = fallbackSeq;
              inboundRecoveryAttemptsForSeq = 0;
              clearInboundTranscriptFallbackTimer();
              if (activeResponseId && !responseHasAudio && activeResponseReason !== "initial-greeting") {
                console.warn(`[Diag-InboundTurn] new user transcript while previous response has no usable audio; resetting stale response state activeResponse=${activeResponseId} seq=${fallbackSeq} previousSeq=${activeResponseInboundTranscriptSeq} (callId=${callId})`);
                clearInboundNoAudioTimer();
                clearResponseDoneFallbackTimer();
                clearMarkFallback();
                activeResponseId = null;
                responsePlaybackMarkName = null;
                responseHasAudio = false;
                responseAudioDone = false;
                responseDoneReceived = false;
                responseAudioDeltaLogged = false;
                activeResponseTwilioChunks = 0;
                activeResponseTwilioBytes = 0;
                aiIsSpeaking = false;
              }
              console.log(`[Diag-InboundTurn] transcript.completed seq=${fallbackSeq} at=${new Date(latestCompletedInboundTranscript.at).toISOString()} text="${transcriptText.slice(0, 160)}" responseCreated=${responseCreatedCount} activeResponse=${activeResponseId || "none"} (callId=${callId})`);
              inboundTranscriptFallbackTimer = setTimeout(() => {
                inboundTranscriptFallbackTimer = null;
                if (fallbackSeq !== inboundTranscriptFallbackSeq || greetingInProgress) return;
                if (responseHasAudio) return;
                if (activeResponseId) {
                  console.warn(`[Diag-InboundTurn] fallback active response has no audio yet; escalating seq=${fallbackSeq} activeResponse=${activeResponseId} (callId=${callId})`);
                  triggerInboundTranscriptRecovery("inbound-transcript-fallback-active-no-audio", activeResponseId);
                  return;
                }
                console.warn(`[Diag-InboundTurn] fallback scheduled fired seq=${fallbackSeq} reason=transcript-no-response activeResponse=${activeResponseId || "none"} text="${transcriptText.slice(0, 160)}" (callId=${callId})`);
                triggerInboundTranscriptRecovery("inbound-transcript-fallback", null);
              }, 900);
              console.log(`[Diag-InboundTurn] fallback scheduled seq=${fallbackSeq} timeoutMs=900 text="${transcriptText.slice(0, 160)}" (callId=${callId})`);
            } else {
              scheduleUserResponseCreate("user-transcript", 150, event.transcript);
            }
            break;

          case "response.function_call_arguments.done": {
            const fnName = event.name;
            console.log(`[MediaStream] Tool called: ${fnName} (callId=${callId})`, event.arguments);

            if (fnName === "end_call") {
              let reason = "Call ended by AI";
              try {
                const args = JSON.parse(event.arguments);
                reason = args.reason || reason;
              } catch {}

              // Guardrail: refuse end_call if it fires too soon after greeting or before
              // any real user utterance. This stops the bot from "hanging up randomly"
              // right after the greeting (e.g. when whisper STT mangles the first reply).
              const msSinceGreeting = greetingCompletedAt ? Date.now() - greetingCompletedAt : 0;
              const tooEarly = !greetingCompletedAt || msSinceGreeting < MIN_MS_AFTER_GREETING_BEFORE_END_CALL;
              const noUserSpeech = userUtteranceCount === 0;
              if (tooEarly || noUserSpeech) {
                console.warn(`[MediaStream] end_call BLOCKED — tooEarly=${tooEarly} (msSinceGreeting=${msSinceGreeting}) noUserSpeech=${noUserSpeech} userUtterances=${userUtteranceCount} reason="${reason}" (callId=${callId})`);
                openaiWs!.send(JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: event.call_id,
                    output: JSON.stringify({
                      success: false,
                      error: "end_call_not_allowed_yet",
                      message: "You may NOT end the call yet. The caller has not had a real chance to speak. Stay on the line, ask them again in their language to describe the situation, and wait for their answer. Do NOT call end_call again until the caller has actually spoken and the case is fully handled.",
                    }),
                  },
                }));
                scheduleUserResponseCreate("tool-result", 50);
                break;
              }

              console.log(`[MediaStream] END CALL requested: ${reason} (callId=${callId})`);
              transcriptLines.push(`[System]: Call ended — ${reason}`);

              const toolResult = {
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: event.call_id,
                  output: JSON.stringify({ success: true, message: "Call will end after your goodbye message." }),
                },
              };
              openaiWs!.send(JSON.stringify(toolResult));
              scheduleUserResponseCreate("tool-result", 50);

              setTimeout(() => {
                console.log(`[MediaStream] Hanging up via Twilio (callId=${callId})`);
                hangUpCall();
              }, 8000); // Give more time for goodbye message to complete
            }

            if (fnName === "lookup_vehicle") {
              let args: any = {};
              try { args = JSON.parse(event.arguments || "{}"); } catch {}
              const vehicle = await crmLookup({
                phone_number: args.phone_number,
                reg_no: args.reg_no,
                description: args.description,
              });
              const output = vehicle
                ? { found: true, vehicle }
                : { found: false, message: "No vehicle found in CRM for the given details." };
              openaiWs!.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: event.call_id,
                  output: JSON.stringify(output),
                },
              }));
              scheduleUserResponseCreate("tool-result", 50);
              transcriptLines.push(`[System]: lookup_vehicle(${JSON.stringify(args)}) → ${vehicle ? vehicle.reg_no + " " + vehicle.owner_name : "not found"}`);
            }

            if (fnName === "send_sms") {
              let args: any = {};
              try { args = JSON.parse(event.arguments || "{}"); } catch (e) {
                console.error(`[MediaStream] send_sms: failed to parse arguments "${event.arguments}":`, e);
              }
              const requestedName = typeof args.template_name === "string" ? args.template_name.trim() : "";
              const recipient = callDirection === "inbound" ? fromNumber : calledNumber;

              console.log(`[MediaStream] send_sms INVOKED (callId=${callId}) requestedName="${requestedName}" callDirection=${callDirection} fromNumber="${fromNumber}" calledNumber="${calledNumber}" recipient="${recipient}" availableTemplates=[${smsMessages.map((m) => `${m.name}(${m.trigger})`).join(", ")}]`);

              // Look up the configured during-call template by exact name.
              // We NEVER use AI-supplied content — only the verbatim configured template.
              const tpl = smsMessages.find(
                (m) => m.trigger === "during" && m.name === requestedName,
              );

              let result: { ok: boolean; sid?: string; error?: string; status?: string; errorCode?: number | string };
              let bodyForLog = "";
              if (!recipient) {
                result = { ok: false, error: "No recipient phone number available for this call" };
              } else if (!requestedName) {
                result = { ok: false, error: "template_name is required" };
              } else if (!tpl) {
                const allowed = smsMessages.filter((m) => m.trigger === "during").map((m) => m.name).join(", ");
                result = { ok: false, error: `Unknown template_name "${requestedName}". Allowed: ${allowed || "(none)"}` };
              } else {
                bodyForLog = substituteVarsRef(tpl.content);
                result = await sendSms(recipient, bodyForLog);
                if (result.ok) {
                  smsSentNames.add(tpl.name);
                  // Persist outbound SMS so we can later correlate inbound replies to this call.
                  persistSmsMessage({
                    call_id: callId || null,
                    agent_id: resolvedAgentId,
                    template_name: tpl.name,
                    direction: "outbound",
                    from_number: config.twilio.fromNumber || "",
                    to_number: recipient,
                    body: bodyForLog,
                    twilio_sid: result.sid || null,
                    status: result.status || "sent",
                  }).catch(() => {});
                }
              }
              console.log(`[MediaStream] send_sms RESULT template="${requestedName}" → ${recipient} ok=${result.ok} sid=${result.sid || "-"} status=${result.status || "-"} errorCode=${result.errorCode || "-"} err=${result.error || "-"} (callId=${callId})`);
              transcriptLines.push(`[System]: send_sms(template="${requestedName}", to=${recipient}, body="${(bodyForLog || "").slice(0, 80)}...") → ${result.ok ? "sent " + result.sid : "failed: " + result.error}`);
              openaiWs!.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: event.call_id,
                  output: JSON.stringify(result.ok
                    ? { success: true, message: `SMS template "${requestedName}" sent. Briefly confirm to the caller in their language.` }
                    : { success: false, error: result.error, instruction: `Tell the caller in their language that the SMS could not be sent right now. Do NOT claim it was sent.` }),
                },
              }));
              scheduleUserResponseCreate("tool-result", 50);
            }
            break;
          }

          case "response.audio.done": {
            const responseId = event.response_id || activeResponseId || null;
            if (!activeResponseId || !responseId || responseId !== activeResponseId) {
              break;
            }

            responseAudioDone = true;

            if (!responseHasAudio) {
              if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                console.warn(`[Diag-InboundTurn] response.audio.done no-audio responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} activeResponseReason=${activeResponseReason} (callId=${callId})`);
                armResponseDoneNoAudioGrace(responseId, activeResponseInboundTranscriptSeq, "response.audio.done-no-audio", 350);
                break;
              }
              maybeCompleteAiTurn("response.audio.done(no-audio)");
              break;
            }

            if (!responsePlaybackMarkName && streamSid && twilioWs.readyState === WebSocket.OPEN) {
              responsePlaybackMarkName = `response-playback:${responseId}:${Date.now()}`;
              console.log(`[MediaStream] Response audio complete, waiting for Twilio playback mark (callId=${callId}, responseId=${responseId}, mark=${responsePlaybackMarkName})`);
              twilioWs.send(JSON.stringify({
                event: "mark",
                streamSid,
                mark: { name: responsePlaybackMarkName },
              }));
              if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
                console.log(`[Diag-InboundTurn] twilio.playback.mark sent mark=${responsePlaybackMarkName} responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} chunks=${activeResponseTwilioChunks} bytes=${activeResponseTwilioBytes} (callId=${callId})`);
              }

              // Safety fallback: if Twilio never sends the mark back, force-complete the turn.
              // For the initial greeting this must be short; otherwise the caller's first
              // real answer after the greeting is dropped while greetingInProgress remains true.
              const markTimeoutMs = greetingInProgress ? 1800 : 10000;
              clearMarkFallback();
              markFallbackTimer = setTimeout(() => {
                if (responsePlaybackMarkName) {
                  console.warn(`[Diag-Gate] greetingPlaying timeout fallback fired=${greetingInProgress} — Twilio mark not received in ${markTimeoutMs}ms, force-completing turn (callId=${callId}, mark=${responsePlaybackMarkName})`);
                  responsePlaybackMarkName = null;
                  maybeCompleteAiTurn("mark-fallback-timeout");
                }
              }, markTimeoutMs);
            }
            break;
          }

          case "response.done": {
            const responseId = event.response?.id || activeResponseId || null;
            if (!activeResponseId || !responseId || responseId !== activeResponseId) {
              break;
            }

            const finishReason: string | null =
              event.response?.status_details?.reason ||
              event.response?.status_details?.type ||
              event.response?.status ||
              null;
            const outputTokens: number | null =
              typeof event.response?.usage?.output_tokens === "number"
                ? event.response.usage.output_tokens
                : null;
            lastResponseFinishReason = finishReason;
            lastResponseOutputTokens = outputTokens;

            responseDoneReceived = true;
            responseDoneCount += 1;
            console.log(
              `[Diag] response.done #${responseDoneCount} responseId=${responseId} finish=${finishReason} output_tokens=${outputTokens} hasAudio=${responseHasAudio} audioDeltas=${assistantAudioDeltaCount} (callId=${callId})`
            );
            if (callDirection === "inbound" && activeResponseReason !== "initial-greeting") {
              console.log(`[Diag-InboundTurn] response.done responseId=${responseId} seq=${activeResponseInboundTranscriptSeq} hasAudio=${responseHasAudio} twilioChunks=${activeResponseTwilioChunks} twilioBytes=${activeResponseTwilioBytes} finish=${finishReason} output_tokens=${outputTokens} (callId=${callId})`);
              if (!responseHasAudio) {
                armResponseDoneNoAudioGrace(responseId, activeResponseInboundTranscriptSeq, "response.done-no-audio", 450);
                break;
              }
            }
            maybeCompleteAiTurn("response.done");
            break;
          }

          case "input_audio_buffer.speech_started":
            speechStartedCount += 1;
            armCallerSpeechWatchdog("speech-started");
            console.log(`[Diag] speech_started #${speechStartedCount} (callId=${callId}) state{greeting=${greetingInProgress},aiSpeaking=${aiIsSpeaking},antiBargein=${antiBargeinEnabled}}`);
            if (greetingInProgress) {
              console.log(`[MediaStream] Ignoring interruption during greeting, clearing buffer (callId=${callId})`);
              openaiWs!.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              break;
            }
            if (antiBargeinEnabled && aiIsSpeaking) {
              console.log(`[MediaStream] Anti-barge-in: ignoring interruption, clearing buffer (callId=${callId})`);
              openaiWs!.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              break;
            }
            console.log(`[MediaStream] Speech started (callId=${callId}, responseId=${activeResponseId})`);
            aiIsSpeaking = false;
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
            }
            break;

          case "input_audio_buffer.speech_stopped":
            speechStoppedCount += 1;
            clearCallerSpeechWatchdog();
            console.log(`[Diag] speech_stopped #${speechStoppedCount} (callId=${callId})`);
            if (callDirection !== "inbound") commitAudioAndCreateResponse("speech-stopped", 120);
            break;

          case "input_audio_buffer.committed":
            bufferCommittedCount += 1;
            console.log(`[Diag] input_audio_buffer.committed #${bufferCommittedCount} item_id=${event.item_id || "?"} (callId=${callId})`);
            if (callDirection !== "inbound") scheduleUserResponseCreate("audio-commit", 1200);
            break;

          case "response.error":
          case "error":
            responseErrorCount += 1;
            clearInboundTranscriptFallbackTimer();
            console.error(`[Diag] OpenAI error #${responseErrorCount} (callId=${callId}):`, JSON.stringify(event.error || event));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("[MediaStream] Error parsing OpenAI message:", err);
      }
    });

    openaiWs.on("close", (code, reason) => {
      if (initialResponseFallbackTimer) {
        clearTimeout(initialResponseFallbackTimer);
        initialResponseFallbackTimer = null;
      }
      clearMarkFallback();
      clearTurnDetectionEnableTimer();
      clearPendingUserResponseTimer();
      clearInboundTranscriptFallbackTimer();
      clearInboundNoAudioTimer();
      clearResponseDoneFallbackTimer();
      clearCallerSpeechWatchdog();
      console.log(`[Diag-OpenAI] OpenAI websocket close code=${code} reason=${reason?.toString() || ""} (callId=${callId})`);
      openaiWs = null;
      finalizeCall();
    });

    openaiWs.on("error", (err) => {
      console.error(`[MediaStream] OpenAI WS error (callId=${callId}):`, err.message);
    });
  };

  // Hang up the Twilio call
  const hangUpCall = () => {
    if (!callSid || !config.twilio.isConfigured) return;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Calls/${callSid}.json`;
    const authHeader = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");

    fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "completed" }).toString(),
    })
      .then(() => console.log(`[MediaStream] Twilio call ended (callSid=${callSid})`))
      .catch((err) => console.error(`[MediaStream] Failed to hang up:`, err));
  };

  // Save final call data to DB
  const finalizeCall = () => {
    if (!callId) return;
    if (callFinalized) return;
    callFinalized = true;
    if (callDurationTimer) clearTimeout(callDurationTimer);
    clearTurnDetectionEnableTimer();
    clearPendingUserResponseTimer();
    clearInboundTranscriptFallbackTimer();
    clearInboundNoAudioTimer();
    clearResponseDoneFallbackTimer();
    clearCallerSpeechWatchdog();
    if (diagnosticSnapshotTimer) {
      clearInterval(diagnosticSnapshotTimer);
      diagnosticSnapshotTimer = null;
    }
    // Final diagnostic summary — single line so it's easy to grep per call.
    console.log(
      `[Diag-Final] callId=${callId} ` +
      `inFrames=${twilioInboundFrames}(fwd=${twilioInboundFramesForwarded},dropG=${twilioInboundFramesDropGreeting},dropC=${twilioInboundFramesDropCooldown},dropAB=${twilioInboundFramesDropAntiBargein},postGreeting=${twilioInboundFramesAfterGreeting}) ` +
      `vad{started=${speechStartedCount},stopped=${speechStoppedCount},committed=${bufferCommittedCount},transcripts=${userTranscriptCount}} ` +
      `items{created=${conversationItemCreatedCount}} ` +
      `resp{createSent=${responseCreateSentCount},created=${responseCreatedCount},done=${responseDoneCount},err=${responseErrorCount},active=${activeResponseId || "none"}} ` +
      `audio{response.audio.delta=${assistantAudioDeltaCount},response.output_audio.delta=${assistantOutputAudioDeltaCount},firstDeltaAt=${firstAssistantAudioDeltaAt || "none"},bytes=${totalAssistantAudioBytes},twilioOut=${twilioOutboundFrames},firstTwilioOutAt=${firstTwilioOutboundAt || "none"},sendErr=${twilioOutboundSendErrors}} ` +
      `twilio{start=${twilioStartReceived},stop=${twilioStopReceived},greetingMark=${twilioGreetingMarkReceived},firstCallerMediaAfterGreetingAt=${firstCallerMediaAfterGreetingAt || "none"}} ` +
      `session{created=${openaiSessionCreatedAt?"yes":"no"},updated=${openaiSessionUpdatedAt?"yes":"no"},config=${lastSessionConfigSent ? JSON.stringify(lastSessionConfigSent) : "none"}} ` +
      diagState() + ` break="${diagnoseBreakPoint()}"`
    );

    // Stop listening for inbound SMS replies for this call
    if (inboundSmsChannel) {
      try {
        inboundSmsChannel.unsubscribe();
      } catch {}
      inboundSmsChannel = null;
    }
    if (locationConfirmChannel) {
      try {
        locationConfirmChannel.unsubscribe();
      } catch {}
      locationConfirmChannel = null;
    }

    const endTime = new Date();
    const durationSeconds = callStartTime
      ? Math.round((endTime.getTime() - callStartTime.getTime()) / 1000)
      : null;

    const transcript = transcriptLines.length > 0 ? transcriptLines.join("\n") : null;

    console.log(`[MediaStream] Finalizing call (callId=${callId}), duration=${durationSeconds}s, transcript lines=${transcriptLines.length}`);

    updateCall(callId, {
      status: "completed",
      ended_at: endTime.toISOString(),
      duration_seconds: durationSeconds,
      transcript,
    });

    // Run post-call analysis if we have a transcript and analysis prompt
    if (transcript && agentAnalysisPrompt) {
      runPostCallAnalysis(callId, transcript, agentAnalysisPrompt);
    }

    // Post-call SMSes — send every "after" template in chronological (configured) order.
    // Skip a template if its name was already sent mid-call (avoids duplicates).
    const afterList = smsMessages.filter((m) => m.trigger === "after");
    if (afterList.length > 0) {
      const recipient = callDirection === "inbound" ? fromNumber : calledNumber;
      if (!recipient) {
        console.warn(`[MediaStream] Post-call SMS skipped: no recipient (callId=${callId})`);
      } else {
        // Send sequentially so they arrive in configured order.
        (async () => {
          for (const m of afterList) {
            if (smsSentNames.has(m.name)) {
              console.log(`[MediaStream] Post-call SMS "${m.name}" skipped (already sent during call) (callId=${callId})`);
              continue;
            }
            const body = substituteVarsRef(m.content);
            const r = await sendSms(recipient, body);
            console.log(`[MediaStream] Post-call SMS "${m.name}" → ${recipient} ok=${r.ok} sid=${r.sid || "-"} err=${r.error || "-"} (callId=${callId})`);
            if (r.ok) {
              smsSentNames.add(m.name);
              persistSmsMessage({
                call_id: callId || null,
                agent_id: resolvedAgentIdRef,
                template_name: m.name,
                direction: "outbound",
                from_number: config.twilio.fromNumber || "",
                to_number: recipient,
                body,
                twilio_sid: r.sid || null,
                status: "sent",
              }).catch(() => {});
            }
          }
        })().catch((err) => console.error(`[MediaStream] Post-call SMS loop error:`, err));
      }
    }
  };

  // Handle messages from Twilio
  twilioWs.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.event) {
        case "connected":
          console.log("[MediaStream] Twilio stream connected");
          break;

        case "start":
          twilioStartReceived = true;
          streamSid = msg.start.streamSid;
          callId = msg.start.customParameters?.callId || "";
          agentId = msg.start.customParameters?.agentId || "";
          calledNumber = msg.start.customParameters?.calledNumber || "";
          fromNumber = msg.start.customParameters?.fromNumber || "";
          callDirection = (msg.start.customParameters?.direction === "inbound" ? "inbound" : "outbound");
          callSid = msg.start.customParameters?.callSid || "";
          campaignId = msg.start.customParameters?.campaignId || "";
          bridgeSelfTest = msg.start.customParameters?.bridgeSelfTest || "";
          logCallDeploymentIdentity();
          // Parse call variables
          const varsParam = msg.start.customParameters?.variables || "";
          if (varsParam) {
            try {
              callVariables = JSON.parse(varsParam);
              console.log(`[MediaStream] Parsed ${Object.keys(callVariables).length} call variables (callId=${callId})`);
            } catch (e) {
              console.warn(`[MediaStream] Failed to parse variables param (callId=${callId})`);
            }
          }
          console.log(`[Diag-Twilio] twilio.start received callId=${callId} streamSid=${streamSid} agentId=${agentId || "(resolve-by-number)"} callSid=${callSid} direction=${callDirection} bridgeSelfTest=${bridgeSelfTest || "none"}`);

          // Periodic diagnostic snapshot — proves end-to-end media flow.
          diagnosticSnapshotTimer = setInterval(() => {
            console.log(
              `[Diag-Snapshot] callId=${callId} ` +
              `inFrames=${twilioInboundFrames}(fwd=${twilioInboundFramesForwarded},dropG=${twilioInboundFramesDropGreeting},dropC=${twilioInboundFramesDropCooldown},dropAB=${twilioInboundFramesDropAntiBargein},postGreeting=${twilioInboundFramesAfterGreeting}) ` +
              `vad{started=${speechStartedCount},stopped=${speechStoppedCount},committed=${bufferCommittedCount},transcripts=${userTranscriptCount}} ` +
              `resp{created=${responseCreatedCount},done=${responseDoneCount},sent=${responseCreateSentCount},err=${responseErrorCount}} ` +
              `audio{response.audio.delta=${assistantAudioDeltaCount},response.output_audio.delta=${assistantOutputAudioDeltaCount},bytes=${totalAssistantAudioBytes},twilioOut=${twilioOutboundFrames},sendErr=${twilioOutboundSendErrors}} ` +
              diagState() + ` sessionCfg=${sessionConfigured} cooldownLeftMs=${Math.max(0, inboundAudioCooldownUntil - Date.now())}`
            );
          }, 5000);

          connectToOpenAI();
          break;

        case "media":
          twilioInboundFrames += 1;
          // Don't forward audio to OpenAI during greeting (prevents VAD triggering)
          if (greetingInProgress) {
            twilioInboundFramesDropGreeting += 1;
            break;
          }
          twilioInboundFramesAfterGreeting += 1;
          if (!firstInboundAudioAfterGreetingLogged) {
            firstInboundAudioAfterGreetingLogged = true;
            firstCallerMediaAfterGreetingAt = new Date().toISOString();
            const sinceGreeting = greetingCompletedAt ? Date.now() - greetingCompletedAt : -1;
            console.log(`[Diag-Twilio] first caller media timestamp after greeting=${firstCallerMediaAfterGreetingAt} msSinceGreetingComplete=${sinceGreeting} totalSinceStart=${twilioInboundFrames} (callId=${callId})`);
            sendTwilioBridgeSelfTestTone("first-caller-media-after-greeting");
          }
          if (greetingCompletedAt && Date.now() - greetingCompletedAt <= 5000) {
            console.log(`[Diag-Gate] caller media within first 5s after greeting frame=${twilioInboundFramesAfterGreeting} callId=${callId} ${diagState()}`);
          }
          // Short cooldown after AI speech finishes — prevents the model from hearing its
          // own just-played audio (echo loop) and re-triggering the same response.
          if (Date.now() < inboundAudioCooldownUntil) {
            twilioInboundFramesDropCooldown += 1;
            if (twilioInboundFramesDropCooldown === 1 || twilioInboundFramesDropCooldown % 25 === 0) {
              console.warn(`[Diag-Drop] caller frame dropped during cooldown count=${twilioInboundFramesDropCooldown} cooldownLeftMs=${inboundAudioCooldownUntil - Date.now()} (callId=${callId})`);
            }
            break;
          }
          // Don't forward audio when anti-barge-in is active and AI is speaking
          if (antiBargeinEnabled && aiIsSpeaking) {
            twilioInboundFramesDropAntiBargein += 1;
            break;
          }
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN && sessionConfigured) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }));
            twilioInboundFramesForwarded += 1;
          } else if (twilioInboundFrames % 50 === 0) {
            console.warn(`[Diag] Cannot forward inbound media: openaiState=${openaiWs?.readyState ?? "null"} sessionConfigured=${sessionConfigured} (callId=${callId})`);
          }
          break;

        case "mark": {
          const markName = msg.mark?.name || "";
          if (markName && responsePlaybackMarkName && markName === responsePlaybackMarkName) {
            if (greetingInProgress) twilioGreetingMarkReceived = true;
            console.log(`[Diag-Twilio] twilio.mark greeting received=${greetingInProgress ? "yes" : "no"} mark=${markName} (callId=${callId})`);
            if (callDirection === "inbound" && !greetingInProgress) {
              console.log(`[Diag-InboundTurn] twilio.playback.mark received mark=${markName} responseId=${activeResponseId || "none"} seq=${activeResponseInboundTranscriptSeq} chunks=${activeResponseTwilioChunks} bytes=${activeResponseTwilioBytes} (callId=${callId})`);
            }
            clearMarkFallback();
            responsePlaybackMarkName = null;
            maybeCompleteAiTurn("twilio.mark");
          }
          break;
        }

        case "stop":
          twilioStopReceived = true;
          console.log(`[Diag-Twilio] twilio.stop received (callId=${callId})`);
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
          }
          break;

        default:
          break;
      }
    } catch (err) {
      console.error("[MediaStream] Error parsing Twilio message:", err);
    }
  });

  twilioWs.on("close", (code, reason) => {
    console.log(`[Diag-Twilio] Twilio websocket close code=${code} reason=${reason?.toString() || ""} (callId=${callId})`);
    clearInboundTranscriptFallbackTimer();
    clearInboundNoAudioTimer();
    clearResponseDoneFallbackTimer();
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    } else {
      finalizeCall();
    }
  });

  twilioWs.on("error", (err) => {
    console.error(`[MediaStream] Twilio WS error (callId=${callId}):`, err.message);
  });
}
