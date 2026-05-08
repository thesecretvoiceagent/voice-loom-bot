/**
 * Shadow-only Deepgram live STT skeleton.
 * Sends Twilio mu-law base64 payloads as binary frames when websocket is OPEN.
 *
 * NEXT (when promoted out of shadow):
 * - Tune model/language per tenant; backoff/retry; metering; correlate utterance IDs with OpenAI timeline.
 */

import WebSocket from "ws";
import type { SttStreamingAdapterHandle } from "./types.js";

export interface DeepgramSttShadowOpts {
  apiKey: string;
  model: string;
  language: string;
  endpointingMs: number | null;
  smartFormat: boolean;
  /** Fires on Deepgram is_final transcripts with non-empty text; read-only orchestration hooks */
  onTrustedFinal?: (payload: { callId: string; text: string }) => void;
}

function logShadowTranscript(callId: string, text: string, isFinal: boolean): void {
  const preview = text.slice(0, 400).replace(/\s+/g, " ").trim();
  console.log(
    `[STT] transcript callId=${callId} provider=deepgram isFinal=${isFinal} text="${preview}"`,
  );
  console.log(
    `[STT-Brain-Shadow] callId=${callId} provider=deepgram transcript="${preview}" isFinal=${isFinal}`,
  );
}

export function createDeepgramSttShadowAdapter(opts: DeepgramSttShadowOpts): SttStreamingAdapterHandle {
  let ws: WebSocket | null = null;
  let activeCallId = "";

  const buildUrl = (): string => {
    const q = new URLSearchParams({
      encoding: "mulaw",
      sample_rate: "8000",
      channels: "1",
      model: opts.model,
      language: opts.language,
    });
    if (opts.endpointingMs !== null) q.set("endpointing", String(opts.endpointingMs));
    if (opts.smartFormat) q.set("smart_format", "true");
    return `wss://api.deepgram.com/v1/listen?${q.toString()}`;
  };

  return {
    providerName: "deepgram",
    model: opts.model,
    language: opts.language,
    streamingEnabled: true,

    start(callId: string) {
      activeCallId = callId || "?";
      if (ws) {
        console.warn(`[STT] Deepgram duplicate start skipped callId=${activeCallId}`);
        return;
      }
      console.log(
        `[STT] provider=deepgram shadow_enabled=true model=${opts.model} language=${opts.language} endpointingMs=${opts.endpointingMs ?? "default"} smartFormat=${opts.smartFormat} callId=${activeCallId}`,
      );
      try {
        ws = new WebSocket(buildUrl(), {
          headers: {
            Authorization: `Token ${opts.apiKey}`,
          },
        });
      } catch (err) {
        console.error(`[STT] error provider=deepgram callId=${activeCallId} phase=constructor`, err);
        ws = null;
        return;
      }

      ws.on("open", () => {
        console.log(`[STT] connected provider=deepgram callId=${activeCallId}`);
      });

      ws.on("message", (data: WebSocket.RawData) => {
        try {
          const raw = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
          const msg = JSON.parse(raw) as {
            type?: string;
            is_final?: boolean;
            channel?: { alternatives?: Array<{ transcript?: string }> };
          };
          if (msg.type === "SpeechStarted") return;
          const text = msg.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
          if (!text) return;
          const isFinal = Boolean(msg.is_final);
          logShadowTranscript(activeCallId, text, isFinal);
          if (isFinal) {
            try {
              opts.onTrustedFinal?.({ callId: activeCallId, text });
            } catch (cbErr) {
              console.error(`[STT] trusted_final_hook_failed callId=${activeCallId}`, cbErr);
            }
          }
        } catch {
          /* ignore malformed */
        }
      });

      ws.on("error", (err) => {
        console.error(`[STT] error provider=deepgram callId=${activeCallId}`, err);
      });

    },

    sendAudioFrameBase64(mulawBase64: string) {
      if (!mulawBase64 || !ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(Buffer.from(mulawBase64, "base64"));
      } catch (err) {
        console.error(`[STT] error provider=deepgram callId=${activeCallId} phase=send`, err);
      }
    },

    stop(callId?: string) {
      const id = callId || activeCallId;
      try {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          ws.close();
        }
      } catch {
        /* ignore */
      }
      ws = null;
      console.log(`[STT] closed provider=deepgram callId=${id}`);
    },
  };
}
