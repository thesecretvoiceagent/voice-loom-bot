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
    const systemMsg = analysisPrompt || "Analyze this call transcript. Provide a brief summary of the conversation, the outcome, and any action items.";
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
      if (summary) {
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

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime";

const DEFAULT_INSTRUCTIONS =
  "You are a helpful AI voice assistant. Be concise and conversational. Respond naturally as if on a phone call.";

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
  let callSid: string = "";
  let campaignId: string = "";

  // Collect transcript turns
  const transcriptLines: string[] = [];
  let callStartTime: Date | null = null;
  let agentAnalysisPrompt: string = "";
  let agentKnowledgeBase: any[] = [];
  let maxCallDurationMinutes: number = 0;
  let callDurationTimer: ReturnType<typeof setTimeout> | null = null;

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

    if (agentId && agentId !== "default") {
      agentConfig = await fetchAgentConfig(agentId);
    }
    if (!agentConfig && calledNumber) {
      console.log(`[MediaStream] No agent by ID, trying phone lookup: ${calledNumber} (callId=${callId})`);
      agentConfig = await fetchAgentByPhoneNumber(calledNumber);
    }
    if (!agentConfig) {
      console.log(`[MediaStream] No agent found, falling back to first active agent (callId=${callId})`);
      agentConfig = await fetchFirstActiveAgent();
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
      }
    } else {
      console.warn(`[MediaStream] No agents found at all, using defaults (callId=${callId})`);
    }

    // Write initial call record to DB
    callStartTime = new Date();
    upsertCall(callId, {
      twilio_call_sid: callSid || null,
      agent_id: agentId !== "default" ? agentId : null,
      campaign_id: campaignId || null,
      to_number: calledNumber || "unknown",
      from_number: config.twilio.fromNumber || null,
      status: "in-progress",
      direction: "outbound",
      started_at: callStartTime.toISOString(),
    });

    const url = `${OPENAI_REALTIME_URL}?model=${config.openai.realtimeModel}`;

    openaiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on("open", () => {
      console.log(`[MediaStream] Connected to OpenAI Realtime (callId=${callId}, voice=${voice})`);

      // Bake greeting into instructions
      const fullInstructions = greeting
        ? `${instructions}\n\nIMPORTANT: You are starting a phone call RIGHT NOW. Your FIRST message must be your greeting. Say exactly: "${greeting}" — in the same language, naturally. Do NOT say anything in English unless the greeting is in English. Do NOT wait for the caller to speak first. Speak immediately.`
        : instructions;

      // Inject knowledge base into instructions
      if (agentKnowledgeBase && agentKnowledgeBase.length > 0) {
        const kbText = agentKnowledgeBase
          .filter((item: any) => item.content && item.content.trim())
          .map((item: any) => `## ${item.name}\n${item.content}`)
          .join("\n\n");
        if (kbText) {
          fullInstructions += `\n\nKNOWLEDGE BASE — Use this information to answer questions accurately:\n\n${kbText}`;
        }
      }

      // Build tools array based on agent config
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

      // Configure session
      const sessionUpdate: any = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: fullInstructions,
          voice,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: {
            model: "whisper-1",
          },
          turn_detection: null,
        },
      };

      if (tools.length > 0) {
        sessionUpdate.session.tools = tools;
      }

      openaiWs!.send(JSON.stringify(sessionUpdate));

      // Trigger greeting
      setTimeout(() => {
        console.log(`[MediaStream] Triggering initial response (callId=${callId}), greeting="${greeting || '(none)'}"`);

        const responseCreate: any = { type: "response.create" };
        if (greeting) {
          responseCreate.response = {
            instructions: `Say exactly this greeting to start the call: "${greeting}". Say it in the original language, naturally, as a phone greeting. Do not add anything else. Do not translate it.`,
          };
        }
        openaiWs!.send(JSON.stringify(responseCreate));

        // Set max call duration timer
        if (maxCallDurationMinutes > 0) {
          const maxMs = maxCallDurationMinutes * 60 * 1000;
          console.log(`[MediaStream] Max call duration: ${maxCallDurationMinutes}m (callId=${callId})`);
          callDurationTimer = setTimeout(() => {
            console.log(`[MediaStream] Max call duration reached, hanging up (callId=${callId})`);
            transcriptLines.push(`[System]: Call ended — max duration (${maxCallDurationMinutes}m) reached`);
            hangUpCall();
          }, maxMs);
        }

        // Enable VAD after greeting
        setTimeout(() => {
          openaiWs!.send(JSON.stringify({
            type: "session.update",
            session: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          }));
          console.log(`[MediaStream] VAD enabled after greeting (callId=${callId})`);
        }, 1000);
      }, 400);
    });

    openaiWs.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());

        switch (event.type) {
          case "session.created":
            console.log(`[MediaStream] OpenAI session created (callId=${callId})`);
            break;

          case "session.updated":
            console.log(`[MediaStream] OpenAI session configured (callId=${callId})`);
            break;

          case "response.audio.delta":
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({
                event: "media",
                streamSid,
                media: { payload: event.delta },
              }));
            }
            break;

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

              // Send tool result back to OpenAI so it can say goodbye
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

              // Hang up after a delay for goodbye
              setTimeout(() => {
                console.log(`[MediaStream] Hanging up via Twilio (callId=${callId})`);
                hangUpCall();
              }, 5000);
            }
            break;
          }

          case "input_audio_buffer.speech_started":
            console.log(`[MediaStream] Speech started, clearing buffer (callId=${callId})`);
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
          callSid = msg.start.customParameters?.callSid || "";
          campaignId = msg.start.customParameters?.campaignId || "";
          console.log(`[MediaStream] Stream started: streamSid=${streamSid} callId=${callId} agentId=${agentId} callSid=${callSid}`);

          connectToOpenAI();
          break;

        case "media":
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }));
          }
          break;

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
