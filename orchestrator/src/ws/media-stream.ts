import WebSocket from "ws";
import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { config } from "../config.js";
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

// Empty fallback — the real instructions come from the agent's "Voice agent
// instructions" (system_prompt) field. The orchestrator must not inject any
// behavioral rules of its own; only the prompt configured in the UI drives
// the AI's behavior.
const DEFAULT_INSTRUCTIONS = "";

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
  let isIiziRoadsideAgent = false;
  let submittedRegistrationNumber = "";
  let submittedCallbackPhoneNumber = "";
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
  let responsePlaybackMarkName: string | null = null;
  let responseHasAudio = false;
  let responseAudioDone = false;
  let responseDoneReceived = false;
  let markFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let callerHasSpokenSinceGreeting = false;
  let callerSubstantiveTurnCount = 0;
  let postGreetingAssistantTurnCount = 0;
  let pendingUserResponseRetry = false;
  let lastUserAudioItemId: string | null = null;
  let lastRespondedUserAudioItemId: string | null = null;
  type PendingUserTurn = { id: string; transcript?: string; source: string; createdAt: number };
  let pendingUserTurn: PendingUserTurn | null = null;
  let assistantResponding = false;
  let responseCreateInFlight = false;
  let responseCreateWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let responseAudioWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let currentResponseCreatedAt = 0;
  let currentResponseAudioDeltaCount = 0;
  let currentResponseOutboundFrameCount = 0;
  let inboundMediaAfterGreetingCount = 0;
  let inboundMediaForwardedAfterGreetingCount = 0;
  let inboundMediaBlockedAfterGreetingCount = 0;

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

  let pendingUserSpeechResponseTimer: ReturnType<typeof setTimeout> | null = null;
  const clearPendingUserSpeechResponseTimer = () => {
    if (pendingUserSpeechResponseTimer) {
      clearTimeout(pendingUserSpeechResponseTimer);
      pendingUserSpeechResponseTimer = null;
    }
  };

  let responseAudioDoneFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  const clearResponseAudioDoneFallback = () => {
    if (responseAudioDoneFallbackTimer) {
      clearTimeout(responseAudioDoneFallbackTimer);
      responseAudioDoneFallbackTimer = null;
    }
  };

  const clearResponseCreateWatchdog = () => {
    if (responseCreateWatchdogTimer) {
      clearTimeout(responseCreateWatchdogTimer);
      responseCreateWatchdogTimer = null;
    }
  };

  const clearResponseAudioWatchdog = () => {
    if (responseAudioWatchdogTimer) {
      clearTimeout(responseAudioWatchdogTimer);
      responseAudioWatchdogTimer = null;
    }
  };

  const normalizeTranscript = (txt: string) =>
    txt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const isUsableSubmittedValue = (value: unknown): value is string => {
    const normalized = (value || "").toString().trim();
    if (!normalized) return false;
    return !/^(0+|null|undefined|n\/a|na|-|—)$/i.test(normalized);
  };

  const normalizeSmsTemplateName = (value: string) => normalizeTranscript(value).replace(/sms$/i, "").trim();

  type SmsPurpose = "registration" | "callback" | "location" | "unknown";
  const classifySmsPurpose = (text: string): SmsPurpose => {
    const normalized = normalizeTranscript(text);
    if (/form2_link|callback|tagasihelist/.test(text) || /callback|tagasihelist/.test(normalized)) return "callback";
    if (/location_link/.test(text) || /location|asukoht/.test(normalized)) return "location";
    if (/form1_link|form_link/.test(text) || /registration|registreerimis|numbrim[aä]rk/.test(normalized)) return "registration";
    return "unknown";
  };

  const findDuringSmsByPurpose = (purpose: SmsPurpose): SmsMessage | undefined => {
    if (purpose === "unknown") return undefined;
    return smsMessages
      .filter((m) => m.trigger === "during")
      .find((m) => classifySmsPurpose(`${m.name} ${m.description || ""} ${m.content}`) === purpose);
  };

  const resolveDuringSmsTemplate = (requestedName: string): SmsMessage | undefined => {
    const during = smsMessages.filter((m) => m.trigger === "during");
    const exact = during.find((m) => m.name === requestedName);
    if (exact) return exact;

    const sameNormalizedName = during.find((m) => normalizeSmsTemplateName(m.name) === normalizeSmsTemplateName(requestedName));
    if (sameNormalizedName) return sameNormalizedName;

    const normalized = normalizeSmsTemplateName(requestedName);
    const aliasMap: Record<string, RegExp> = {
      "tagasihelistamise numbri": /callback|tagasihelist/i,
      "callback number": /callback|tagasihelist/i,
      "retrieval of callback number through": /callback|tagasihelist/i,
      "registreerimisnumbri": /registration|registreerimis|numbrim[aä]rk/i,
      "registration number": /registration|registreerimis|numbrim[aä]rk/i,
      "asukoha": /location|asukoht/i,
      "location": /location|asukoht/i,
    };
    const matcher = aliasMap[normalized];
    if (!matcher) return undefined;
    return during.find((m) => matcher.test(`${m.name} ${m.description || ""} ${m.content}`));
  };

  const startInboundAudioCooldown = (ms: number, reason: string) => {
    inboundAudioCooldownUntil = Math.max(inboundAudioCooldownUntil, Date.now() + ms);
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    }
    console.log(`[MediaStream] Inbound audio cooldown ${ms}ms after ${reason} (callId=${callId})`);
  };

  const resetResponseState = () => {
    activeResponseId = null;
    assistantResponding = false;
    responseCreateInFlight = false;
    responsePlaybackMarkName = null;
    responseHasAudio = false;
    responseAudioDone = false;
    responseDoneReceived = false;
    currentResponseCreatedAt = 0;
    currentResponseAudioDeltaCount = 0;
    currentResponseOutboundFrameCount = 0;
    clearMarkFallback();
    clearResponseAudioDoneFallback();
    clearResponseCreateWatchdog();
    clearResponseAudioWatchdog();
  };

  const sendUserTurnResponseCreate = (source: string) => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
      console.error(`[MediaStream] response.create blocked: OpenAI websocket not open (callId=${callId}, source=${source}, itemId=${pendingUserTurn?.id || lastUserAudioItemId || "unknown"})`);
      return false;
    }
    if (!sessionConfigured) {
      console.warn(`[MediaStream] response.create blocked: session not configured (callId=${callId}, source=${source})`);
      return false;
    }
    if (greetingInProgress) {
      console.warn(`[MediaStream] response.create queued: greeting still playing (callId=${callId}, source=${source}, itemId=${pendingUserTurn?.id || "unknown"})`);
      return false;
    }
    if (activeResponseId && currentResponseCreatedAt && Date.now() - currentResponseCreatedAt > 15000) {
      console.error(`[MediaStream] response.create blocked by stale active response; cancelling first (callId=${callId}, staleResponseId=${activeResponseId}, ageMs=${Date.now() - currentResponseCreatedAt})`);
      try {
        openaiWs.send(JSON.stringify({ type: "response.cancel" }));
      } catch (err) {
        console.error(`[MediaStream] response.cancel failed before user response.create (callId=${callId}):`, err);
      }
      resetResponseState();
      aiIsSpeaking = false;
    }
    if (responseCreateInFlight || assistantResponding || activeResponseId) {
      console.warn(`[MediaStream] response.create blocked: assistant response active (callId=${callId}, source=${source}, inFlight=${responseCreateInFlight}, assistantResponding=${assistantResponding}, responseId=${activeResponseId || "none"})`);
      return false;
    }
    if (aiIsSpeaking && !responsePlaybackMarkName) {
      console.warn(`[MediaStream] Clearing stale aiIsSpeaking before user response.create (callId=${callId}, source=${source})`);
      aiIsSpeaking = false;
    }

    const turn = pendingUserTurn || (lastUserAudioItemId ? { id: lastUserAudioItemId, source, createdAt: Date.now() } : null);
    if (!turn) {
      console.warn(`[MediaStream] response.create blocked: no committed user turn (callId=${callId}, source=${source})`);
      return false;
    }
    if (lastRespondedUserAudioItemId === turn.id) {
      console.warn(`[MediaStream] response.create deduped for user turn (callId=${callId}, source=${source}, itemId=${turn.id})`);
      pendingUserTurn = null;
      return false;
    }

    lastRespondedUserAudioItemId = turn.id;
    pendingUserTurn = null;
    responseCreateInFlight = true;
    pendingUserResponseRetry = true;
    const response: Record<string, unknown> = { modalities: ["text", "audio"] };
    console.warn(`[MediaStream] >>> response.create sent after committed user turn (callId=${callId}, source=${source}, itemId=${turn.id}, transcript="${(turn.transcript || "").slice(0, 120)}")`);
    openaiWs.send(JSON.stringify({ type: "response.create", response }));
    clearResponseCreateWatchdog();
    responseCreateWatchdogTimer = setTimeout(() => {
      if (responseCreateInFlight && !activeResponseId) {
        console.error(`[MediaStream] HARD ERROR: response.create sent but no response.created/response.error within 3s (callId=${callId}, itemId=${turn.id}, source=${source})`);
        responseCreateInFlight = false;
      }
    }, 3000);
    return true;
  };

  const processPendingUserTurn = (source: string) => {
    if (!pendingUserTurn) return false;
    const sent = sendUserTurnResponseCreate(source);
    if (!sent) {
      clearPendingUserSpeechResponseTimer();
      pendingUserSpeechResponseTimer = setTimeout(() => {
        pendingUserSpeechResponseTimer = null;
        processPendingUserTurn(`${source}:retry`);
      }, 250);
    }
    return sent;
  };

  const scheduleManualResponseAfterUserSpeech = (source: string, delayMs = 0) => {
    clearPendingUserSpeechResponseTimer();
    pendingUserSpeechResponseTimer = setTimeout(() => {
      pendingUserSpeechResponseTimer = null;
      processPendingUserTurn(source);
    }, delayMs);
  };

  const enableTurnDetection = () => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
    // Flush any audio that accumulated during greeting playback (echo, line noise)
    // BEFORE enabling VAD, so it doesn't immediately fire a false speech_started.
    openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    const sessionPatch: any = {
      turn_detection: {
        type: "server_vad",
        threshold: 0.55,            // Balanced for phone audio; 0.7 was missing quiet callers.
        prefix_padding_ms: 500,
        silence_duration_ms: 900,   // Wait longer before considering speech ended
        create_response: false,     // Manual path: every committed user turn gets exactly one response.create.
        interrupt_response: false,  // Barge-in is guarded manually below to avoid invalid response.cancel calls.
      },
    };
    // Activate tools NOW (post-greeting). They were withheld during the greeting
    // so the model couldn't immediately call end_call or lookup_vehicle.
    if (!toolsActivated && pendingToolsForActivation.length > 0) {
      sessionPatch.tools = pendingToolsForActivation;
      toolsActivated = true;
      console.log(`[MediaStream] Activating ${pendingToolsForActivation.length} tools post-greeting (callId=${callId})`);
    }
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: sessionPatch,
    }));
    console.log(`[MediaStream] Turn detection enabled after greeting (manual response mode) (callId=${callId}, threshold=${sessionPatch.turn_detection.threshold}, silenceMs=${sessionPatch.turn_detection.silence_duration_ms})`);
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
    const recoveryCooldownMs = pendingRecoveryCooldownMs || 1200;
    pendingRecoveryCooldownMs = 0;

    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;

    if (greetingInProgress) {
      greetingInProgress = false;
      const greetingVadDelayMs = source === "twilio.mark" ? 0 : Math.min(recoveryCooldownMs, 300);
      console.log(`[MediaStream] Greeting playback complete via ${source}, enabling VAD after ${greetingVadDelayMs}ms (callId=${callId}, responseId=${completedResponseId})`);
      clearTurnDetectionEnableTimer();
      if (greetingVadDelayMs === 0) {
        enableTurnDetection();
      } else {
        startInboundAudioCooldown(greetingVadDelayMs, source);
        turnDetectionEnableTimer = setTimeout(() => {
          turnDetectionEnableTimer = null;
          enableTurnDetection();
        }, greetingVadDelayMs);
      }
      return;
    }

    startInboundAudioCooldown(recoveryCooldownMs, source);

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
      console.log(`[MediaStream] Loaded agent config: "${agentConfig.name}" (callId=${callId})`);
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

      const scopeText = `${(agentConfig as any).name || ""} ${(agentConfig as any).system_prompt || ""}`;
      isIiziRoadsideAgent = /iizi/i.test(scopeText) && /(autoabi|roadside)/i.test(scopeText);
      if (isIiziRoadsideAgent) {
        console.log(`[MediaStream] IIZI roadside runtime guards enabled (callId=${callId})`);
      }
    } else {
      console.warn(`[MediaStream] No agents found at all, using defaults (callId=${callId})`);
    }

    // Inbound CRM prefetch: identify caller by phone number so the agent knows who's calling.
    // Exposed via callVariables so the system prompt can reference {{caller_name}}, {{caller_reg_no}}, etc.
    if (isIiziRoadsideAgent && callDirection === "inbound" && fromNumber) {
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

    const buildRegistrationOnlyLink = (caseIdValue: string, tokenValue: string): string => {
      const formBase = config.publicBaseUrl
        ? `${config.publicBaseUrl.replace(/\/+$/, "")}/api/forms/reg`
        : `${(locationPageBase || LOVABLE_FALLBACK).replace(/\/+$/, "")}/form`;
      return `${formBase}?caseId=${encodeURIComponent(caseIdValue)}&token=${encodeURIComponent(tokenValue)}`;
    };

    const normalizeRegistrationSmsLink = (text: string): string => {
      if (!text) return text;
      return text.replace(/https:\/\/[^\s]+\/form\?caseId=([0-9a-f-]{36})&token=([0-9a-f]{64})(?:&mode=(?:reg|both))?/gi, (_match, caseIdValue, tokenValue) => {
        return buildRegistrationOnlyLink(caseIdValue, tokenValue);
      }).replace(/https:\/\/[^\s]+\/functions\/v1\/iizi-reg-form\?src=https:\/\/[^\s]+\/functions\/v1\/iizi-reg-form\?caseId=([0-9a-f-]{36})&token=([0-9a-f]{64})/gi, (_match, caseIdValue, tokenValue) => {
        return buildRegistrationOnlyLink(caseIdValue, tokenValue);
      }).replace(/https:\/\/[^\s]+\/functions\/v1\/iizi-reg-form\?src=https:\/\/[^\s]+\/form\?caseId=([0-9a-f-]{36})&token=([0-9a-f]{64})(?:&mode=(?:reg|both))?/gi, (_match, caseIdValue, tokenValue) => {
        return buildRegistrationOnlyLink(caseIdValue, tokenValue);
      });
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
        const baseFormUrl = `${locationPageBase}${formPath}?caseId=${encodeURIComponent(callId)}&token=${formToken}`;
        const regFormUrl = buildRegistrationOnlyLink(callId, formToken);
        // form1_link / form_link → SMS #1: registration number only via dedicated backend form.
        // form2_link             → SMS #3: callback phone number only (mode=phone)
        callVariables.form1_link = regFormUrl;
        callVariables.form_link = regFormUrl;
        callVariables.form2_link = `${baseFormUrl}&mode=phone`;
        console.log(`[MediaStream] form1_link built: ${callVariables.form1_link}`);
        console.log(`[MediaStream] form_link built: ${callVariables.form_link}`);
        console.log(`[MediaStream] form2_link built: ${callVariables.form2_link}`);
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
                  openaiWs.send(JSON.stringify({ type: "response.create" }));
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
                    const sysMsg = `[SYSTEM EVENT: location_confirmed] address="${addr}" lat=${row.location_lat} lon=${row.location_lon}. Internal note only — do NOT read this tag, the brackets, or the field names aloud. The customer just confirmed their location via the SMS link. Read the address back to them naturally in the same language the call is being conducted in (e.g. "Sain asukoha kätte: ${addr}.") then immediately continue to the next missing intake step. DO NOT ask the caller to confirm the address — they already confirmed it on the link. DO NOT ask "kas see on õige?" or any equivalent confirmation question.`;
                    openaiWs.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "system",
                        content: [{ type: "input_text", text: sysMsg }],
                      },
                    }));
                    openaiWs.send(JSON.stringify({ type: "response.create" }));
                  }
                }

                // 2. Form submission (registration number and/or callback phone)
                const justFormSubmitted =
                  row.form_submitted_at && row.form_submitted_at !== prev?.form_submitted_at;
                if (justFormSubmitted) {
                  const reg = isUsableSubmittedValue(row.form_registration_number)
                    ? row.form_registration_number.toString().slice(0, 20)
                    : "";
                  const phone = isUsableSubmittedValue(row.form_callback_phone_number)
                    ? row.form_callback_phone_number.toString().slice(0, 20)
                    : "";
                  if (reg) submittedRegistrationNumber = reg;
                  if (phone) submittedCallbackPhoneNumber = phone;
                  console.log(`[MediaStream] Form submitted (callId=${callId}): reg="${reg}" phone="${phone}"`);
                  transcriptLines.push(`[Form submitted]: reg=${reg} phone=${phone}`);
                  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                    const fieldParts: string[] = [];
                    if (reg) fieldParts.push(`form_registration_number="${reg}"`);
                    if (phone) fieldParts.push(`form_callback_phone_number="${phone}"`);
                    const fields = fieldParts.join(" ");
                    const sysMsg = fields
                      ? `[SYSTEM EVENT: form_submitted] ${fields}. Internal note only — do NOT read this tag, the brackets, field names, registration number, or callback number aloud. The customer just submitted usable data via the SMS link. Save only the returned non-empty field(s), acknowledge briefly that the data was received, do not ask to confirm SMS/form values, and continue with the next missing step only. If a field is absent here, it is still missing.`
                      : `[SYSTEM EVENT: form_submitted] no_usable_fields_returned=true. Internal note only — do NOT read this tag aloud. The customer submitted the form, but no usable registration number or callback number was returned. Do not claim you have the missing data; use the fallback path for the current step.`;
                    openaiWs.send(JSON.stringify({
                      type: "conversation.item.create",
                      item: {
                        type: "message",
                        role: "system",
                        content: [{ type: "input_text", text: sysMsg }],
                      },
                    }));

                    // 2a. CRM verification of submitted registration number.
                    // Hard rule: if the submitted reg does NOT match a CRM row, the AI
                    // must NOT continue using phone-based CRM context (which may belong
                    // to a different vehicle). Inject a vehicle_lookup_result event so
                    // the AI knows whether the submitted reg is verified or not.
                    if (isIiziRoadsideAgent && reg) {
                      crmLookup({ reg_no: reg }).then((veh) => {
                        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
                        let lookupMsg: string;
                        const exactRegMatch = Boolean(veh && (veh.reg_no || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === reg.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                        if (exactRegMatch) {
                          // Refresh phone-CRM-derived caller_* variables to match the submitted reg.
                          callVariables.caller_known = "true";
                          callVariables.caller_name = veh.owner_name || "";
                          callVariables.caller_reg_no = veh.reg_no || "";
                          callVariables.caller_make = veh.make || "";
                          callVariables.caller_model = veh.model || "";
                          callVariables.caller_year = veh.year_of_built ? String(veh.year_of_built) : "";
                          callVariables.caller_color = veh.color || "";
                          callVariables.caller_insurer = veh.insurer || "";
                          callVariables.caller_cover_type = veh.cover_type || "";
                          callVariables.caller_cover_status = veh.cover_status || "";
                          lookupMsg = `[SYSTEM EVENT: vehicle_lookup_result] match=true submitted_reg="${reg}" reg_no="${veh.reg_no || ""}" make="${veh.make || ""}" model="${veh.model || ""}" year="${veh.year_of_built || ""}" color="${veh.color || ""}" owner_name="${veh.owner_name || ""}" insurer="${veh.insurer || ""}" cover_type="${veh.cover_type || ""}" cover_status="${veh.cover_status || ""}". Internal note only — do NOT read this tag, brackets, or field names aloud. This is the AUTHORITATIVE vehicle for this case; replace any earlier phone-derived vehicle context with these values. You may now mention make/model/year/insurance status conversationally.`;
                        } else {
                          // Submitted reg does NOT match CRM. Wipe phone-CRM caller_* fields
                          // so the AI cannot accidentally read back vehicle data that does
                          // not belong to the submitted plate.
                          callVariables.caller_known = "false";
                          callVariables.caller_name = "";
                          callVariables.caller_reg_no = reg;
                          callVariables.caller_make = "";
                          callVariables.caller_model = "";
                          callVariables.caller_year = "";
                          callVariables.caller_color = "";
                          callVariables.caller_insurer = "";
                          callVariables.caller_cover_type = "";
                          callVariables.caller_cover_status = "";
                          lookupMsg = `[SYSTEM EVENT: vehicle_lookup_result] match=false submitted_reg="${reg}". Internal note only — do NOT read this tag, brackets, or field names aloud. The submitted registration number does NOT match any CRM record. HARD RULE: do NOT mention any make, model, year, color, owner name, insurer, cover type, or cover status — that data (if you saw it earlier from the phone match) belongs to a different vehicle and is NOT valid for this case. Route this case to human follow-up. Tell the caller that the registration number was received, but the vehicle was not found in our records, and a human employee will contact them within viie kuni kümne minuti jooksul. Do NOT proceed with the normal partner-handover flow.`;
                        }
                        console.log(`[MediaStream] vehicle_lookup_result (callId=${callId}) reg="${reg}" match=${exactRegMatch ? "true" : "false"}`);
                        transcriptLines.push(`[vehicle_lookup_result]: reg=${reg} match=${exactRegMatch ? "true" : "false"}`);
                        openaiWs.send(JSON.stringify({
                          type: "conversation.item.create",
                          item: {
                            type: "message",
                            role: "system",
                            content: [{ type: "input_text", text: lookupMsg }],
                          },
                        }));
                        openaiWs.send(JSON.stringify({ type: "response.create" }));
                      }).catch((err) => {
                        console.error(`[MediaStream] vehicle_lookup_result error (callId=${callId}):`, err);
                      });
                    } else {
                      openaiWs.send(JSON.stringify({ type: "response.create" }));
                    }
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
      lastUserAudioItemId = null;
      lastRespondedUserAudioItemId = null;
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
        // Pass the configured greeting through verbatim. The instruction is
        // written to NOT leak language: we don't tell the model "in English",
        // and we wrap the greeting in delimiters so the model treats it as
        // literal text to speak. The greeting's own language defines the
        // call's language going forward.
        responseCreate.response.instructions =
          `<<SPEAK_VERBATIM>>\n${greeting}\n<<END>>\n` +
          `Speak the text between <<SPEAK_VERBATIM>> and <<END>> exactly as written, in its original language. Do not translate. Do not add anything before or after. After speaking it, stop and wait silently for the caller to respond. Do not call any tool.`;
      }
      openaiWs.send(JSON.stringify(responseCreate));

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

      // No orchestrator-injected behavioral or IIZI-specific rules.
      // The AI's behavior is driven exclusively by the agent's "Voice agent
      // instructions" (system_prompt) plus its knowledge base above.

      // Inject SMS catalog so the AI knows which named SMSes are available, when to use them, and what they say.
      const duringSmsList = smsMessages.filter((m) => m.trigger === "during");
      const afterSmsList = smsMessages.filter((m) => m.trigger === "after");
      if (duringSmsList.length > 0 || afterSmsList.length > 0) {
        let smsBlock = `\n\nAVAILABLE SMS TEMPLATES — These are the ONLY SMSes you can send. Each has a fixed name and EXACT text. You may NOT change the text. To send one, call the send_sms tool with template_name set to the exact name below. Pick the template whose "When to use" matches the current moment in the conversation. Never use any template name from the system prompt if it is not listed here.`;
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
        smsBlock += `\n\nRules:\n- Pick the SMS whose "When to use" matches the moment.\n- Never invent a new SMS. Never paraphrase the content.\n- If none fit, do not send anything.\n- Template names in this AVAILABLE SMS TEMPLATES block override any conflicting names in the agent prompt.\n- After the customer replies via SMS, you will receive a system message starting with "[SYSTEM EVENT: sms_received]". Treat it as an internal note (do NOT read the tag aloud) and acknowledge the SMS content naturally in the conversation only if it contains usable data.`;
        fullInstructions += smsBlock;
      }

      const tools: any[] = [];

      // Do not expose end_call in the live Realtime session. In practice the
      // model can call tools without speaking first, which makes the phone
      // appear to hang up right after the caller says something. Calls still
      // end normally via caller hangup, Twilio status, or max_call_duration.
      if (false && agentTools.includes("end_call")) {
        tools.push({
          type: "function",
          name: "end_call",
          description: "End the current phone call. Use only when the conversation is finished according to your instructions.",
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
          description: "Look up a vehicle in the CRM by registration plate or free-text description. Returns owner name, vehicle, insurer, cover type/status, or found:false if no match.",
          parameters: {
            type: "object",
            properties: {
              reg_no: {
                type: "string",
                description: "Registration plate, e.g. '495BJS'.",
              },
              description: {
                type: "string",
                description: "Free-text vehicle description, e.g. 'must BMW 535D 2006'.",
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
          description: `Send one of the pre-configured SMS templates to the other party on this call (${recipientHint}). The server sends the template text verbatim — you do not write the message and you do not pass a phone number. Allowed template_name values: ${allowedNames}. Returns success:true with sid on success, or success:false with error on failure.`,
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
            console.log(`[MediaStream] OpenAI session created (callId=${callId})`);
            break;

          case "session.updated":
            if (!sessionConfigured) {
              sessionConfigured = true;
              console.log(`[MediaStream] OpenAI session configured (callId=${callId})`);
              maybeStartInitialResponse();
            } else {
              console.log(`[MediaStream] OpenAI session updated (callId=${callId})`);
            }
            break;

          case "response.created":
            clearPendingUserSpeechResponseTimer();
            clearResponseAudioDoneFallback();
            activeResponseId = event.response?.id || null;
            responsePlaybackMarkName = null;
            responseHasAudio = false;
            responseAudioDone = false;
            responseDoneReceived = false;
            ignoreAudioUntilNextResponse = false;
            aiIsSpeaking = true; // Keep this true until Twilio confirms playback completion.
            lastResponseFinishReason = null;
            lastResponseOutputTokens = null;
            break;

          case "response.audio.delta": {
            const responseId = event.response_id || activeResponseId || null;
            if (ignoreAudioUntilNextResponse) {
              break;
            }
            if (!activeResponseId || !responseId || responseId !== activeResponseId) {
              break;
            }
            responseHasAudio = true;
            pendingUserResponseRetry = false;
            clearResponseAudioDoneFallback();
            responseAudioDoneFallbackTimer = setTimeout(() => {
              if (!activeResponseId || responseAudioDone || !responseDoneReceived) return;
              console.warn(`[MediaStream] response.audio.done missing after audio; force-completing audio state (callId=${callId}, responseId=${activeResponseId})`);
              responseAudioDone = true;
              maybeCompleteAiTurn("response.audio.done-fallback");
            }, 1200);
            if (streamSid && twilioWs.readyState === WebSocket.OPEN && event.delta) {
              // OpenAI sends large audio chunks (~200ms). Twilio Media Streams plays smoothest
              // when each `media` event carries ~20ms of ulaw audio (160 bytes @ 8kHz).
              // Splitting prevents underruns/overruns that are heard as static/clicks.
              try {
                const raw = Buffer.from(event.delta, "base64");
                const FRAME = 160; // 20ms @ 8kHz mu-law
                for (let offset = 0; offset < raw.length; offset += FRAME) {
                  const chunk = raw.subarray(offset, Math.min(offset + FRAME, raw.length));
                  twilioWs.send(JSON.stringify({
                    event: "media",
                    streamSid,
                    media: { payload: chunk.toString("base64") },
                  }));
                }
              } catch (e) {
                // Fallback: forward as-is if buffer ops fail
                twilioWs.send(JSON.stringify({
                  event: "media",
                  streamSid,
                  media: { payload: event.delta },
                }));
              }
            }
            break;
          }

          case "response.audio_transcript.done": {
            const assistantTranscript = (event.transcript || "").toString();
            console.log(`[MediaStream] AI said (callId=${callId}): ${assistantTranscript}`);
            transcriptLines.push(`[Agent]: ${assistantTranscript}`);
            if (!greetingInProgress) {
              postGreetingAssistantTurnCount += 1;
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

          case "conversation.item.input_audio_transcription.completed": {
            const userTranscript = (event.transcript || "").toString();
            lastUserAudioItemId = event.item_id || lastUserAudioItemId || null;
            console.log(`[MediaStream] User said (callId=${callId}): ${userTranscript}`);
            transcriptLines.push(`[User]: ${userTranscript}`);
            // Real user speech resets the repeat counter.
            lastAssistantTranscript = "";
            repeatedAssistantTranscriptCount = 0;
            pendingRecoveryCooldownMs = 0;
            if (normalizeTranscript(userTranscript)) {
              callerHasSpokenSinceGreeting = true;
              callerSubstantiveTurnCount += 1;
              scheduleManualResponseAfterUserSpeech("input_audio_transcription.completed", 450);
            }
            break;
          }

          case "conversation.item.input_audio_transcription.failed":
            console.warn(`[MediaStream] User transcription failed (callId=${callId}):`, event.error || event);
            scheduleManualResponseAfterUserSpeech("input_audio_transcription.failed", 250);
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

              // No orchestrator-side guard on end_call. The agent's prompt is
              // the sole authority on when the call should end.

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
              openaiWs!.send(JSON.stringify({ type: "response.create", response: { modalities: ["text", "audio"] } }));

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
              openaiWs!.send(JSON.stringify({ type: "response.create", response: { modalities: ["text", "audio"] } }));
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

              const requestedPurpose = classifySmsPurpose(requestedName);
              let tpl = resolveDuringSmsTemplate(requestedName);
              if (isIiziRoadsideAgent && requestedPurpose !== "unknown") {
                const purposeTpl = findDuringSmsByPurpose(requestedPurpose);
                if (purposeTpl && purposeTpl.name !== tpl?.name) {
                  console.warn(`[MediaStream] send_sms purpose override requested="${requestedName}" purpose=${requestedPurpose}: using configured template="${purposeTpl.name}" instead of "${tpl?.name || "none"}" (callId=${callId})`);
                  tpl = purposeTpl;
                }
              }

              const tplPurpose = tpl ? classifySmsPurpose(`${tpl.name} ${tpl.description || ""} ${tpl.content}`) : "unknown";
              if (isIiziRoadsideAgent && tpl && tplPurpose === "registration" && !tpl.content.includes("{{form1_link}}")) {
                console.warn(`[MediaStream] send_sms guard: registration template "${tpl.name}" did not contain {{form1_link}}; forcing reg-only link text (callId=${callId})`);
                tpl = { ...tpl, content: `Palun sisestage oma numbrimärk: {{form1_link}}` };
              }
              if (isIiziRoadsideAgent && tplPurpose === "registration" && submittedRegistrationNumber) {
                const callbackTpl = findDuringSmsByPurpose("callback");
                if (callbackTpl) {
                  console.warn(`[MediaStream] send_sms guard: registration already submitted (${submittedRegistrationNumber}); switching to callback SMS "${callbackTpl.name}" (callId=${callId})`);
                  tpl = callbackTpl;
                }
              }
              // Extra safety: if we already sent the registration SMS at least once and the
              // model is asking for it again WITHOUT a submitted reg, it almost certainly
              // intends the next-stage callback SMS (common LLM confusion between "send
              // registration link again" vs "send the next link"). If a callback template
              // exists and has not been sent yet, switch.
              {
                const tplPurposeNow = tpl ? classifySmsPurpose(`${tpl.name} ${tpl.description || ""} ${tpl.content}`) : "unknown";
                if (isIiziRoadsideAgent && tplPurposeNow === "registration" && tpl && smsSentNames.has(tpl.name)) {
                  const callbackTpl = findDuringSmsByPurpose("callback");
                  if (callbackTpl && !smsSentNames.has(callbackTpl.name)) {
                    console.warn(`[MediaStream] send_sms guard: registration template "${tpl.name}" already sent; switching to unsent callback SMS "${callbackTpl.name}" (callId=${callId})`);
                    tpl = callbackTpl;
                  }
                }
              }
              if (isIiziRoadsideAgent && tpl && classifySmsPurpose(`${tpl.name} ${tpl.description || ""} ${tpl.content}`) === "callback" && !tpl.content.includes("{{form2_link}}")) {
                console.warn(`[MediaStream] send_sms guard: callback template "${tpl.name}" did not contain {{form2_link}}; forcing phone-only link text (callId=${callId})`);
                tpl = { ...tpl, content: `Palun sisestage oma tagasihelistamise number siin lingil: {{form2_link}}` };
              }

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
                const substitutedBody = substituteVarsRef(tpl.content);
                const finalTplPurpose = classifySmsPurpose(`${tpl.name} ${tpl.description || ""} ${tpl.content}`);
                bodyForLog = finalTplPurpose === "registration"
                  ? normalizeRegistrationSmsLink(substitutedBody)
                  : substitutedBody;
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
                    ? { success: true, sid: result.sid || null, template_name: tpl?.name || requestedName }
                    : { success: false, error: result.error, template_name: tpl?.name || requestedName }),
                },
              }));
              openaiWs!.send(JSON.stringify({ type: "response.create", response: { modalities: ["text", "audio"] } }));
            }
            break;
          }

          case "response.audio.done": {
            const responseId = event.response_id || activeResponseId || null;
            if (!activeResponseId || !responseId || responseId !== activeResponseId) {
              break;
            }

            clearResponseAudioDoneFallback();

            responseAudioDone = true;

            if (!responseHasAudio) {
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

              // Safety fallback: if Twilio never sends the mark back within 10 seconds,
              // force-complete the turn to prevent the call from hanging forever.
              clearMarkFallback();
              markFallbackTimer = setTimeout(() => {
                if (responsePlaybackMarkName) {
                  console.warn(`[MediaStream] Mark fallback triggered — Twilio mark not received in 10s, force-completing turn (callId=${callId}, mark=${responsePlaybackMarkName})`);
                  responsePlaybackMarkName = null;
                  maybeCompleteAiTurn("mark-fallback-timeout");
                }
              }, 10000);
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
            console.log(
              `[MediaStream] response.done callId=${callId} responseId=${responseId} finish=${finishReason} output_tokens=${outputTokens} cap=${greetingTokenLimitRaised ? INITIAL_GREETING_MAX_RESPONSE_OUTPUT_TOKENS : configuredMaxResponseOutputTokens}`
            );
            if (responseHasAudio && !responseAudioDone) {
              clearResponseAudioDoneFallback();
              responseAudioDoneFallbackTimer = setTimeout(() => {
                if (!activeResponseId || responseAudioDone) return;
                console.warn(`[MediaStream] response.done arrived without response.audio.done; force-completing audio state (callId=${callId}, responseId=${activeResponseId})`);
                responseAudioDone = true;
                maybeCompleteAiTurn("response.done-audio-fallback");
              }, 1200);
            }
            if (!responseHasAudio && pendingUserResponseRetry && !greetingInProgress) {
              pendingUserResponseRetry = false;
              console.warn(`[MediaStream] Post-user response completed with no audio; retrying once with tools disabled (callId=${callId}, responseId=${responseId})`);
              setTimeout(() => {
                if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || activeResponseId) return;
                openaiWs.send(JSON.stringify({
                  type: "response.create",
                  response: {
                    modalities: ["text", "audio"],
                    tool_choice: "none",
                  },
                }));
              }, 150);
            }
            maybeCompleteAiTurn("response.done");
            break;
          }

          case "input_audio_buffer.speech_stopped":
            console.log(`[MediaStream] Speech stopped (callId=${callId}, itemId=${event.item_id || "unknown"})`);
            break;

          case "input_audio_buffer.committed":
            lastUserAudioItemId = event.item_id || lastUserAudioItemId || null;
            console.log(`[MediaStream] Caller audio committed; scheduling manual response (callId=${callId}, itemId=${lastUserAudioItemId || "unknown"}, previous=${event.previous_item_id || "none"})`);
            scheduleManualResponseAfterUserSpeech("input_audio_buffer.committed", 900);
            break;

          case "input_audio_buffer.speech_started":
            // If greeting is in progress, completely ignore user speech and clear any buffered audio
            if (greetingInProgress) {
              console.log(`[MediaStream] Ignoring interruption during greeting, clearing buffer (callId=${callId})`);
              openaiWs!.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              break;
            }
            // If anti-barge-in is enabled and AI is speaking, ignore and clear buffered audio
            if (antiBargeinEnabled && aiIsSpeaking) {
              console.log(`[MediaStream] Anti-barge-in: ignoring interruption, clearing buffer (callId=${callId})`);
              openaiWs!.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
              break;
            }
            // Only barge-in / cancel when there is actually an active assistant response.
            // Sending response.cancel with no active response causes OpenAI to error and can
            // leave the conversation in a state where the next VAD-triggered response never
            // fires — the user spoke but the agent stayed silent forever.
            if (activeResponseId) {
              console.log(`[MediaStream] Speech started during AI response, cancelling (callId=${callId}, responseId=${activeResponseId})`);
              resetResponseState();
              ignoreAudioUntilNextResponse = true;
              aiIsSpeaking = false;
              if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
                twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
              }
              openaiWs!.send(JSON.stringify({ type: "response.cancel" }));
            } else {
              console.log(`[MediaStream] Speech started (no active response — waiting for VAD commit, then manual response) (callId=${callId}, itemId=${event.item_id || "unknown"})`);
            }
            break;

          case "error":
            console.error(`[MediaStream] OpenAI error (callId=${callId}):`, event.error);
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
      clearResponseAudioDoneFallback();
      clearTurnDetectionEnableTimer();
      console.log(`[MediaStream] OpenAI WS closed (callId=${callId}): ${code} ${reason}`);
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
    if (callDurationTimer) clearTimeout(callDurationTimer);
    clearTurnDetectionEnableTimer();
    clearPendingUserSpeechResponseTimer();
    clearResponseAudioDoneFallback();

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
          streamSid = msg.start.streamSid;
          callId = msg.start.customParameters?.callId || "";
          agentId = msg.start.customParameters?.agentId || "";
          calledNumber = msg.start.customParameters?.calledNumber || "";
          fromNumber = msg.start.customParameters?.fromNumber || "";
          callDirection = (msg.start.customParameters?.direction === "inbound" ? "inbound" : "outbound");
          callSid = msg.start.customParameters?.callSid || "";
          campaignId = msg.start.customParameters?.campaignId || "";
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
          console.log(`[MediaStream] Stream started: streamSid=${streamSid} callId=${callId} agentId=${agentId} callSid=${callSid}`);

          connectToOpenAI();
          break;

        case "media":
          // Don't forward audio to OpenAI during greeting (prevents VAD triggering)
          if (greetingInProgress) {
            break;
          }
          // Short cooldown after AI speech finishes — prevents the model from hearing its
          // own just-played audio (echo loop) and re-triggering the same response.
          if (Date.now() < inboundAudioCooldownUntil) {
            break;
          }
          // Don't forward audio when anti-barge-in is active and AI is speaking
          if (antiBargeinEnabled && aiIsSpeaking) {
            break;
          }
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN && sessionConfigured) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }));
          }
          break;

        case "mark": {
          const markName = msg.mark?.name || "";
          if (markName && responsePlaybackMarkName && markName === responsePlaybackMarkName) {
            console.log(`[MediaStream] Twilio playback mark received (callId=${callId}, mark=${markName})`);
            clearMarkFallback();
            responsePlaybackMarkName = null;
            maybeCompleteAiTurn("twilio.mark");
          }
          break;
        }

        case "stop":
          console.log(`[MediaStream] Twilio stream stopped (callId=${callId})`);
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

  twilioWs.on("close", () => {
    console.log(`[MediaStream] Twilio WS closed (callId=${callId})`);
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
