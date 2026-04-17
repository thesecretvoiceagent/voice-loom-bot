import WebSocket from "ws";
import { config } from "../config.js";
import {
  fetchAgentConfig,
  fetchAgentByPhoneNumber,
  fetchFirstActiveAgent,
  upsertCall,
  updateCall,
} from "../supabase.js";

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
async function sendSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!config.twilio.isConfigured) {
    return { ok: false, error: "Twilio not configured" };
  }
  if (!to || !body) {
    return { ok: false, error: "Missing 'to' or 'body'" };
  }
  if (!config.twilio.fromNumber) {
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
    if (!res.ok) {
      console.error(`[sendSms] HTTP ${res.status}`, data);
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, sid: data?.sid };
  } catch (err: any) {
    console.error(`[sendSms] error:`, err);
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
  let smsTemplate: string = "";
  let smsDuringCall: boolean = false;
  let smsAfterCall: boolean = false;
  let smsSentDuringCall = false;
  let substituteVarsRef: (text: string) => string = (t) => t;
  let maxCallDurationMinutes: number = 0;
  let callDurationTimer: ReturnType<typeof setTimeout> | null = null;
  let greetingInProgress = true; // Protect initial greeting from interruption
  let activeResponseId: string | null = null; // Track current response to discard stale audio
  let ignoreAudioUntilNextResponse = false;
  let sessionConfigured = false;
  let pendingInitialResponse = false;
  let initialResponseFallbackTimer: ReturnType<typeof setTimeout> | null = null;

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

    const completedResponseId = activeResponseId;
    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;

    if (greetingInProgress) {
      greetingInProgress = false;
      console.log(`[MediaStream] Greeting playback complete via ${source}, enabling VAD (callId=${callId}, responseId=${completedResponseId})`);
      enableTurnDetection();
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
        // SMS settings
        if (typeof settings.sms_template === "string") smsTemplate = settings.sms_template;
        smsDuringCall = settings.sms_during_call === true && !!smsTemplate;
        smsAfterCall = settings.sms_after_call === true && !!smsTemplate;
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

    if (Object.keys(callVariables).length > 0) {
      instructions = substituteVars(instructions);
      greeting = substituteVars(greeting);
      console.log(`[MediaStream] Substituted ${Object.keys(callVariables).length} variables into prompt (callId=${callId})`);
    }
    // Make substitute available outside this scope for SMS sending
    substituteVarsRef = substituteVars;

    // Write initial call record to DB
    callStartTime = new Date();
    upsertCall(callId, {
      twilio_call_sid: callSid || null,
      agent_id: agentId && agentId !== "default" ? agentId : null,
      campaign_id: campaignId || null,
      // For inbound: caller is From, our number is To. For outbound: callee is To.
      to_number: callDirection === "inbound" ? (calledNumber || "unknown") : (calledNumber || "unknown"),
      from_number: callDirection === "inbound" ? (fromNumber || null) : (config.twilio.fromNumber || null),
      status: "in-progress",
      direction: callDirection,
      started_at: callStartTime.toISOString(),
    });

    const url = `${OPENAI_REALTIME_URL}?model=${config.openai.realtimeModel}`;

    sessionConfigured = false;
    pendingInitialResponse = false;
    resetResponseState();
    ignoreAudioUntilNextResponse = false;
    aiIsSpeaking = false;
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

      const responseCreate: any = { type: "response.create" };
      if (greeting) {
        responseCreate.response = {
          instructions: `Say exactly this greeting to start the call: "${greeting}". Say it in the original language, naturally, as a phone greeting. Do not add anything else. Do not translate it.`,
        };
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

      let fullInstructions = greeting
        ? `${instructions}\n\nIMPORTANT: You are starting a phone call RIGHT NOW. Your FIRST message must be your greeting. Say exactly: "${greeting}" — in the same language, naturally. Do NOT say anything in English unless the greeting is in English. Do NOT wait for the caller to speak first. Speak immediately.`
        : instructions;

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

      if (smsDuringCall) {
        const recipientHint = callDirection === "inbound"
          ? "the caller's number is the From number of this call"
          : "the called number is the To number of this call";
        tools.push({
          type: "function",
          name: "send_sms",
          description: `Send a follow-up SMS text message to the other party RIGHT NOW during the call. Use this when the conversation calls for it (e.g. confirming details, sending a link, or as agreed). The recipient is the other party on this call (${recipientHint}); you do NOT need to pass a phone number. The 'message' parameter is optional — if omitted, the agent's pre-configured SMS template is used (recommended). After calling, briefly confirm to the caller in their language that the SMS has been sent.`,
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Optional override for the SMS text. If omitted, the configured template is sent. Keep under 1600 chars.",
              },
            },
          },
        });
      }

      // Clamp temperature to OpenAI Realtime's valid range [0.6, 1.2] — values outside
      // this range can cause the model to emit malformed audio (heard as static/clicks).
      const rawTemp = agentConfig ? agentTemperature : 0.6;
      const sessionTemperature = Math.min(1.2, Math.max(0.6, rawTemp));
      const sessionUpdate: any = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: fullInstructions,
          voice,
          temperature: sessionTemperature,
          max_response_output_tokens: "inf",
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

          case "response.audio_transcript.done":
            console.log(`[MediaStream] AI said (callId=${callId}): ${event.transcript}`);
            transcriptLines.push(`[Agent]: ${event.transcript}`);
            break;

          case "conversation.item.input_audio_transcription.completed":
            console.log(`[MediaStream] User said (callId=${callId}): ${event.transcript}`);
            transcriptLines.push(`[User]: ${event.transcript}`);
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
