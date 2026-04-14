import WebSocket from "ws";
import { config } from "../config.js";
import { fetchAgentConfig, fetchAgentByPhoneNumber, fetchFirstActiveAgent } from "../supabase.js";

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

  // Connect to OpenAI Realtime API with agent-specific config
  const connectToOpenAI = async () => {
    if (!config.openai.isConfigured) {
      console.error("[MediaStream] OpenAI not configured, cannot bridge");
      twilioWs.close();
      return;
    }

    // Fetch agent configuration from database
    // Priority: agentId param → phone number lookup → first active agent
    let instructions = DEFAULT_INSTRUCTIONS;
    let greeting = "";
    let voice = "alloy";
    let agentConfig = null;

    if (agentId && agentId !== "default") {
      agentConfig = await fetchAgentConfig(agentId);
    }

    // If no agent found by ID, try by phone number (inbound calls)
    if (!agentConfig && calledNumber) {
      console.log(`[MediaStream] No agent by ID, trying phone lookup: ${calledNumber} (callId=${callId})`);
      agentConfig = await fetchAgentByPhoneNumber(calledNumber);
    }

    // Last resort: use first active agent
    if (!agentConfig) {
      console.log(`[MediaStream] No agent found, falling back to first active agent (callId=${callId})`);
      agentConfig = await fetchFirstActiveAgent();
    }

    if (agentConfig) {
      console.log(`[MediaStream] Loaded agent config: "${agentConfig.name}" (callId=${callId})`);
      if (agentConfig.system_prompt) instructions = agentConfig.system_prompt;
      if (agentConfig.greeting) greeting = agentConfig.greeting;
      if (agentConfig.voice) voice = agentConfig.voice;
    } else {
      console.warn(`[MediaStream] No agents found at all, using defaults (callId=${callId})`);
    }

    const url = `${OPENAI_REALTIME_URL}?model=${config.openai.realtimeModel}`;

    openaiWs = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    openaiWs.on("open", () => {
      console.log(`[MediaStream] Connected to OpenAI Realtime (callId=${callId}, voice=${voice})`);

      // Bake the greeting into the instructions so the AI knows what to say first
      const fullInstructions = greeting
        ? `${instructions}\n\nIMPORTANT: You are starting a phone call RIGHT NOW. Your FIRST message must be your greeting. Say exactly: "${greeting}" — in the same language, naturally. Do NOT say anything in English unless the greeting is in English. Do NOT wait for the caller to speak first. Speak immediately.`
        : instructions;

      // Configure session WITHOUT turn detection — we trigger the first response manually
      const sessionUpdate = {
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

      openaiWs!.send(JSON.stringify(sessionUpdate));

      // Force the AI to speak first by triggering a response immediately
      setTimeout(() => {
        console.log(`[MediaStream] Triggering initial response (callId=${callId}), greeting="${greeting || '(none)'}"`);

        // Use response.create with explicit instructions to force immediate speech
        const responseCreate: any = { type: "response.create" };

        if (greeting) {
          // Override instructions for this specific response to guarantee the greeting
          responseCreate.response = {
            instructions: `Say exactly this greeting to start the call: "${greeting}". Say it in the original language, naturally, as a phone greeting. Do not add anything else. Do not translate it.`,
          };
        }

        openaiWs!.send(JSON.stringify(responseCreate));

        // Enable VAD after a delay so the AI can finish its greeting
        setTimeout(() => {
          const enableVAD = {
            type: "session.update",
            session: {
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          };
          openaiWs!.send(JSON.stringify(enableVAD));
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
            // Forward audio from OpenAI → Twilio
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              const mediaMsg = {
                event: "media",
                streamSid,
                media: {
                  payload: event.delta, // base64-encoded g711_ulaw
                },
              };
              twilioWs.send(JSON.stringify(mediaMsg));
            }
            break;

          case "response.audio_transcript.done":
            console.log(`[MediaStream] AI said (callId=${callId}): ${event.transcript}`);
            break;

          case "conversation.item.input_audio_transcription.completed":
            console.log(`[MediaStream] User said (callId=${callId}): ${event.transcript}`);
            break;

          case "input_audio_buffer.speech_started":
            // User started speaking — interrupt any ongoing AI response
            console.log(`[MediaStream] Speech started, clearing buffer (callId=${callId})`);
            // Send clear event to Twilio to stop playing current audio
            if (streamSid && twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
            }
            // Cancel any in-progress OpenAI response
            openaiWs!.send(JSON.stringify({ type: "response.cancel" }));
            break;

          case "error":
            console.error(`[MediaStream] OpenAI error (callId=${callId}):`, event.error);
            break;

          default:
            // Suppress noisy events
            break;
        }
      } catch (err) {
        console.error("[MediaStream] Error parsing OpenAI message:", err);
      }
    });

    openaiWs.on("close", (code, reason) => {
      console.log(`[MediaStream] OpenAI WS closed (callId=${callId}): ${code} ${reason}`);
      openaiWs = null;
    });

    openaiWs.on("error", (err) => {
      console.error(`[MediaStream] OpenAI WS error (callId=${callId}):`, err.message);
    });
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
          console.log(`[MediaStream] Stream started: streamSid=${streamSid} callId=${callId} agentId=${agentId} calledNumber=${calledNumber}`);

          // Now connect to OpenAI (async — fetches agent config first)
          connectToOpenAI();
          break;

        case "media":
          // Forward audio from Twilio → OpenAI
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
              type: "input_audio_buffer.append",
              audio: msg.media.payload, // base64-encoded g711_ulaw
            };
            openaiWs.send(JSON.stringify(audioAppend));
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
    }
  });

  twilioWs.on("error", (err) => {
    console.error(`[MediaStream] Twilio WS error (callId=${callId}):`, err.message);
  });
}
