import { config } from "../config.js";

/**
 * Deterministic text-to-speech for IIZI scripted lines.
 *
 * The realtime (generative) model cannot be forced to speak a fixed string
 * verbatim — it will occasionally improvise or hallucinate. To guarantee 0%
 * drift on scripted lines we bypass the model entirely: we synthesize the exact
 * text with a real TTS endpoint, downsample to telephony format, and stream the
 * resulting G.711 mu-law 8 kHz bytes straight to Twilio (the same format Twilio
 * Media Streams expect). The audio literally *is* the script, so the wording is
 * guaranteed.
 */

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

/** OpenAI `pcm` response format is 24 kHz, 16-bit signed LE, mono. */
const PCM_INPUT_RATE = 24000;
const TELEPHONY_RATE = 8000;
const DOWNSAMPLE_FACTOR = PCM_INPUT_RATE / TELEPHONY_RATE; // 3

const SYNTH_TIMEOUT_MS = 8000;

// Cache of already-synthesized lines. Static scripted lines repeat constantly
// across calls, so caching removes synthesis latency and cost for them. Keyed by
// model+voice+text. Bounded to avoid unbounded growth on dynamic readbacks.
const MAX_CACHE_ENTRIES = 256;
const mulawCache = new Map<string, Buffer>();

const cacheKey = (model: string, voice: string, text: string): string =>
  `${model}::${voice}::${text}`;

const cacheGet = (key: string): Buffer | null => {
  const hit = mulawCache.get(key);
  if (!hit) return null;
  // refresh LRU position
  mulawCache.delete(key);
  mulawCache.set(key, hit);
  return hit;
};

const cacheSet = (key: string, buf: Buffer): void => {
  if (mulawCache.has(key)) mulawCache.delete(key);
  mulawCache.set(key, buf);
  while (mulawCache.size > MAX_CACHE_ENTRIES) {
    const oldest = mulawCache.keys().next().value;
    if (oldest === undefined) break;
    mulawCache.delete(oldest);
  }
};

/** Encode one 16-bit linear PCM sample to a G.711 mu-law byte. */
const encodeMuLawSample = (sample: number): number => {
  const MULAW_BIAS = 0x84; // 132
  const MULAW_CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    /* find segment */
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
};

/**
 * Downsample 24 kHz s16le mono PCM to 8 kHz and encode to G.711 mu-law.
 * Each output sample averages a group of 3 input samples (a cheap low-pass that
 * is more than adequate for 8 kHz telephony bandwidth).
 */
const pcm24kToMulaw8k = (pcm: Buffer): Buffer => {
  const sampleCount = Math.floor(pcm.length / 2);
  const outLen = Math.floor(sampleCount / DOWNSAMPLE_FACTOR);
  const out = Buffer.allocUnsafe(outLen);
  for (let i = 0; i < outLen; i++) {
    const base = i * DOWNSAMPLE_FACTOR * 2;
    const s0 = pcm.readInt16LE(base);
    const s1 = pcm.readInt16LE(base + 2);
    const s2 = pcm.readInt16LE(base + 4);
    const avg = ((s0 + s1 + s2) / 3) | 0;
    out[i] = encodeMuLawSample(avg);
  }
  return out;
};

export interface SynthResult {
  /** G.711 mu-law, 8 kHz, mono bytes ready to frame for Twilio. */
  mulaw: Buffer;
  fromCache: boolean;
}

/**
 * Synthesize `text` to G.711 mu-law 8 kHz bytes. Throws on failure (network,
 * non-2xx, empty audio, timeout) so the caller can fall back / retry.
 */
export const synthesizeMulaw8k = async (
  text: string,
  opts?: { voice?: string; model?: string; instructions?: string },
): Promise<SynthResult> => {
  const clean = (text || "").trim();
  if (!clean) throw new Error("tts_empty_text");
  if (!config.openai.apiKey) throw new Error("tts_no_api_key");

  const model = opts?.model || config.openai.ttsModel;
  const voice = opts?.voice || config.openai.ttsVoice;
  const key = cacheKey(model, voice, clean);

  const cached = cacheGet(key);
  if (cached) return { mulaw: cached, fromCache: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNTH_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      model,
      voice,
      input: clean,
      response_format: "pcm",
    };
    if (opts?.instructions) body.instructions = opts.instructions;
    const res = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`tts_http_${res.status}:${errText.slice(0, 200)}`);
    }
    const pcm = Buffer.from(await res.arrayBuffer());
    if (pcm.length < 2) throw new Error("tts_empty_audio");
    const mulaw = pcm24kToMulaw8k(pcm);
    if (mulaw.length === 0) throw new Error("tts_empty_after_encode");
    cacheSet(key, mulaw);
    return { mulaw, fromCache: false };
  } finally {
    clearTimeout(timer);
  }
};
