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

  // Anti-barge-in: when true, don't forward user audio to OpenAI while AI is speaking
  let antiBargeinEnabled = false;
  let aiIsSpeaking = false; // Track whether AI is currently outputting audio or Twilio is still playing it
  let responsePlaybackMarkName: string | null = null;
  let responseHasAudio = false;
  let responseAudioDone = false;
  let responseDoneReceived = false;
  let markFallbackTimer: ReturnType<typeof setTimeout> | null = null;

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

  const resetResponseState = () => {
    activeResponseId = null;
    responsePlaybackMarkName = null;
    responseHasAudio = false;
    responseAudioDone = false;
    responseDoneReceived = false;
    clearMarkFallback();
  };

  const enableTurnDetection = () => {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) return;
    // Flush any audio that accumulated during greeting playback (echo, line noise)
    // BEFORE enabling VAD, so it doesn't immediately fire a false speech_started.
    openaiWs.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
          threshold: 0.7,             // Higher = less sensitive to noise (default 0.5)
          prefix_padding_ms: 500,
          silence_duration_ms: 900,   // Wait longer before considering speech ended
        },
      },
    }));
  };

  const maybeCompleteAiTurn = (source: string) => {
    if (!responseDoneReceived) return;
    if (responseHasAudio && !responseAudioDone) return;
    if (responsePlaybackMarkName) return;

    if (greetingTokenLimitRaised) {
      // Keep the larger response budget for the rest of the call.
      // Lowering it immediately after the opener has proven unstable in this live bridge.
      greetingTokenLimitRaised = false;
    }

    const completedResponseId = activeResponseId;
    const recoveryCooldownMs = pendingRecoveryCooldownMs || 1200;
    pendingRecoveryCooldownMs = 0;

    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;
    startInboundAudioCooldown(recoveryCooldownMs, source);

    if (greetingInProgress) {
      greetingInProgress = false;
      console.log(`[MediaStream] Greeting playback complete via ${source}, enabling VAD after cooldown (callId=${callId}, responseId=${completedResponseId})`);
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

    // Inject location confirmation link variable so SMS templates can use {{location_link}}.
    // Token = HMAC-SHA256(callId, LOCATION_TOKEN_SECRET) — verified server-side on /api/location/confirm.
    const azureStaticBase = (process.env.AZURE_STATIC_BASE_URL || "").replace(/\/+$/, "");
    const tokenSecret = process.env.LOCATION_TOKEN_SECRET || "";
    if (callId && azureStaticBase && tokenSecret) {
      try {
        const crypto = await import("crypto");
        const locToken = crypto.createHmac("sha256", tokenSecret).update(callId).digest("hex");
        callVariables.location_link = `${azureStaticBase}/index.html?caseId=${encodeURIComponent(callId)}&token=${locToken}`;
      } catch (err) {
        console.error(`[MediaStream] Failed to build location_link:`, err);
      }
    }

    if (Object.keys(callVariables).length > 0) {
      instructions = substituteVars(instructions);
      greeting = substituteVars(greeting);
      console.log(`[MediaStream] Substituted ${Object.keys(callVariables).length} variables into prompt (callId=${callId})`);
    }
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
                  const sysMsg = `📱 Customer replied via SMS (from ${fromNum}): "${replyBody}". Acknowledge what they sent in the conversation right now — for example, read any phone number or address back to confirm it. Speak in the same language the call is being conducted in.`;
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
                const justConfirmed =
                  row.location_confirmed === true && prev?.location_confirmed !== true;
                if (!justConfirmed) return;
                const addr = (row.location_address || "").toString().slice(0, 300);
                console.log(`[MediaStream] Location confirmed (callId=${callId}): "${addr}"`);
                transcriptLines.push(`[Location confirmed]: ${addr} (${row.location_lat},${row.location_lon})`);
                if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                  const sysMsg = `📍 Klient kinnitas oma asukoha SMS-i lingilt: "${addr}". Loe see talle vestluses kohe tagasi sama keeles, mida vestluses kasutate, ja küsi kinnitust. Ära paku midagi muud — ainult kinnita asukoht.`;
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
        response: {},
      };
      if (greeting) {
        responseCreate.response.instructions = `Say exactly this greeting to start the call: "${greeting}". Say it in the original language, naturally, as a phone greeting. Do not add anything else. Do not translate it.`;
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
        smsBlock += `\n\nRules:\n- Pick the SMS whose "When to use" matches the moment.\n- Never invent a new SMS. Never paraphrase the content.\n- If none fit, do not send anything.\n- After the customer replies via SMS, you will receive a system message starting with "📱 Customer replied via SMS:". Acknowledge what they sent (e.g. confirm a number back to them) in the conversation.`;
        fullInstructions += smsBlock;
      }

      const tools: any[] = [];

      if (agentTools.includes("end_call")) {
        tools.push({
          type: "function",
          name: "end_call",
          description: "End the current phone call. Use when the conversation is naturally finished, the user says goodbye, or the user asks to hang up.",
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
          description: "Look up a vehicle in the CRM. ALWAYS call this immediately when the caller mentions ANY identifying detail — a registration plate (registreerimismärk like 484DLC), a phone number, OR a description of the car (make/model/color/year, e.g. 'must BMW 535D 2006'). Use the description field as a fallback when you cannot make out the plate clearly. Returns owner name, vehicle, insurer, cover type/status. If no match, returns found:false.",
          parameters: {
            type: "object",
            properties: {
              reg_no: {
                type: "string",
                description: "Estonian registration plate, e.g. '495BJS'. Strip spaces, uppercase. Pass even if you are not 100% sure — server does fuzzy matching.",
              },
              phone_number: {
                type: "string",
                description: "Phone number in E.164 format, e.g. '+3725541645'.",
              },
              description: {
                type: "string",
                description: "Free-text vehicle description in any language (Estonian preferred), e.g. 'must BMW 535D 2006' or 'punane Saab 9-5'. Use when caller describes the car instead of giving the plate.",
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
            : DEFAULT_MAX_RESPONSE_OUTPUT_TOKENS,
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

      if (tools.length > 0) {
        sessionUpdate.session.tools = tools;
      }

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
            activeResponseId = event.response?.id || null;
            responsePlaybackMarkName = null;
            responseHasAudio = false;
            responseAudioDone = false;
            responseDoneReceived = false;
            ignoreAudioUntilNextResponse = false;
            aiIsSpeaking = true; // Keep this true until Twilio confirms playback completion.
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
            console.log(`[MediaStream] User said (callId=${callId}): ${event.transcript}`);
            transcriptLines.push(`[User]: ${event.transcript}`);
            // Real user speech resets the repeat counter.
            lastAssistantTranscript = "";
            repeatedAssistantTranscriptCount = 0;
            pendingRecoveryCooldownMs = 0;
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
              openaiWs!.send(JSON.stringify({ type: "response.create" }));

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
              openaiWs!.send(JSON.stringify({ type: "response.create" }));
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
              openaiWs!.send(JSON.stringify({ type: "response.create" }));
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

            responseDoneReceived = true;
            console.log(`[MediaStream] OpenAI response done received, waiting for playback completion if needed (callId=${callId}, responseId=${responseId})`);
            maybeCompleteAiTurn("response.done");
            break;
          }

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
            console.log(`[MediaStream] Speech started, clearing buffer (callId=${callId}, responseId=${activeResponseId})`);
            resetResponseState();
            ignoreAudioUntilNextResponse = true;
            aiIsSpeaking = false;
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
            }
            openaiWs!.send(JSON.stringify({ type: "response.cancel" }));
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
