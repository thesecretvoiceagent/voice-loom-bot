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

  // Connect to OpenAI Realtime API with agent-specific config
  const connectToOpenAI = async () => {
    if (!config.openai.isConfigured) {
      console.error("[MediaStream] OpenAI not configured, cannot bridge");
      twilioWs.close();
      return;
    }

    // Fetch agent configuration from database
    let instructions = DEFAULT_INSTRUCTIONS;
    let greeting = "";
    let voice = "alloy";

    if (agentId && agentId !== "default") {
      const agentConfig = await fetchAgentConfig(agentId);
      if (agentConfig) {
        console.log(`[MediaStream] Loaded agent config: "${agentConfig.name}" (callId=${callId})`);
        if (agentConfig.system_prompt) {
          instructions = agentConfig.system_prompt;
        }
        if (agentConfig.greeting) {
          greeting = agentConfig.greeting;
        }
        if (agentConfig.voice) {
          voice = agentConfig.voice;
        }
      } else {
        console.warn(`[MediaStream] Agent ${agentId} not found, using defaults (callId=${callId})`);
      }
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

      // Configure the session with agent-specific settings
      const sessionUpdate = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions,
          voice,
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: {
            model: "whisper-1",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
        },
      };

      openaiWs!.send(JSON.stringify(sessionUpdate));

      // If agent has a greeting, make OpenAI speak it immediately
      if (greeting) {
        console.log(`[MediaStream] Sending greeting (callId=${callId}): "${greeting.substring(0, 60)}..."`);
        // Add a conversation item with the greeting text, then trigger a response
        const greetingEvent = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: `[SYSTEM: The call has just connected. Say your greeting to the caller. Your greeting is: "${greeting}". Say it naturally, do not add anything extra.]`,
              },
            ],
          },
        };
        // Small delay to let session config apply
        setTimeout(() => {
          openaiWs!.send(JSON.stringify(greetingEvent));
          openaiWs!.send(JSON.stringify({ type: "response.create" }));
        }, 200);
      }
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
          console.log(`[MediaStream] Stream started: streamSid=${streamSid} callId=${callId} agentId=${agentId}`);

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
