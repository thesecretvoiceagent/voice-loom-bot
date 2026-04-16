

# Fix AI Voice Agent Behavior — Stop Rambling, Stay On Script

## Problem
The OpenAI Realtime session has **no temperature control** and the instructions don't enforce brevity or script adherence. The AI rambles, goes off-topic, and gives long responses instead of staying focused.

## Root Cause
In `orchestrator/src/ws/media-stream.ts`, the `session.update` config sent to OpenAI Realtime has:
- No `temperature` setting (defaults to ~0.8 which encourages creativity)
- No `max_response_output_tokens` limit
- Default instructions are vague ("Be concise and conversational")
- No explicit constraints against rambling or going off-script

## Plan

### 1. Add temperature + token limits to OpenAI Realtime session config
**File:** `orchestrator/src/ws/media-stream.ts`

In the `session.update` payload (around line 179), add:
- `temperature: 0.6` — reduces randomness, keeps AI focused
- `max_response_output_tokens: 150` — hard cap on response length (~2-3 sentences spoken)

These are supported by the OpenAI Realtime API session config.

### 2. Harden the default instructions
**File:** `orchestrator/src/ws/media-stream.ts`

Replace the vague `DEFAULT_INSTRUCTIONS` (line 49) with strict behavioral rules:
```
You are a professional AI phone agent. Follow these rules strictly:
1. NEVER go off-topic. Only discuss what your instructions cover.
2. Keep every response to 1-3 short sentences maximum.
3. Do NOT elaborate unless explicitly asked.
4. Do NOT make up information not in your instructions or knowledge base.
5. If unsure, say you'll follow up — don't guess.
6. Stay in character at all times. Follow the script exactly.
```

### 3. Inject behavioral guardrails into every agent's system prompt
**File:** `orchestrator/src/ws/media-stream.ts`

When building `fullInstructions` from the agent's `system_prompt`, append a non-negotiable footer:
```
BEHAVIORAL RULES (always follow):
- Maximum 1-3 sentences per response.
- Stay strictly on topic. Do not improvise or add unrequested information.
- Follow the script above exactly. Do not deviate.
```

This ensures even if a user writes a loose system prompt, the AI still behaves.

### 4. Make temperature configurable per agent
**File:** `src/pages/CreateAgent.tsx` (Settings tab)

Add a "Temperature" slider (0.1–1.0, default 0.6) in the agent settings tab, stored in `settings.temperature`. The orchestrator reads this and applies it to the session config.

**File:** `orchestrator/src/ws/media-stream.ts`

Read `settings.temperature` from agent config and use it in the session update, falling back to 0.6.

### 5. Tighten VAD (Voice Activity Detection) settings
**File:** `orchestrator/src/ws/media-stream.ts`

Current VAD config (line 228):
- `threshold: 0.5` — fine
- `silence_duration_ms: 500` — too short, causes AI to jump in too fast

Change to:
- `silence_duration_ms: 700` — gives caller more time to finish speaking
- `prefix_padding_ms: 400` — slightly more context captured

---

## Files Changed
| File | Change |
|------|--------|
| `orchestrator/src/ws/media-stream.ts` | Add temperature, token limits, strict instructions, read per-agent temperature |
| `src/pages/CreateAgent.tsx` | Add Temperature slider in Settings tab |

## No database changes needed
Temperature is stored in the existing `settings` JSONB column on the `agents` table.

