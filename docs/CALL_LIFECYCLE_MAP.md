# Call Lifecycle Map

## Scope

This document records the current end-to-end call lifecycle as implemented in the repo today, including overlap points and transitional legacy surfaces.

Cross-links:

- [BACKEND_OWNERSHIP_MATRIX.md](BACKEND_OWNERSHIP_MATRIX.md)
- [TABLE_ACCESS_AND_TENANCY_INVENTORY.md](TABLE_ACCESS_AND_TENANCY_INVENTORY.md)

## Current End-to-End Lifecycle

### 1. Frontend trigger

The current outbound call trigger starts in the control plane:

- UI code calls `src/services/orchestratorClient.ts`.
- `src/services/callService.ts` and `src/services/twilioService.ts` both delegate call start to the orchestrator.
- The runtime endpoint is `/api/calls/start` on `orchestrator/`, with the base URL loaded from `organization_settings.orchestrator_url` or `VITE_API_BASE_URL`.

Current primary owner:

- `src/` initiates the request.
- `orchestrator/` owns execution after the request leaves the browser.

### 2. Orchestrator route

`orchestrator/src/routes/calls.ts`:

- validates `to_number` and `agent_id`
- fetches agent runtime config through `fetchAgentConfig()` -> `supabase/functions/agent-config`
- builds Twilio voice webhook URL `/twilio/voice`
- builds Twilio status callback URL `/twilio/status`
- optionally enables recording callbacks to `/twilio/recording-status`
- starts the outbound call via Twilio REST

Important current-state note:

- this route does not write the initial `calls` row directly
- the initial durable write happens later inside the media-stream handler through `call-write`

### 3. Twilio interaction

Twilio receives the outbound call request and calls back into the orchestrator:

- Twilio hits `POST /twilio/voice`
- orchestrator returns TwiML that:
  - starts recording callbacks to `/twilio/recording-status`
  - opens a bidirectional media stream to `/twilio/stream`
  - passes `callId`, `agentId`, `campaignId`, `callSid`, numbers, direction, and variables as stream parameters

Twilio status callbacks also hit orchestrator:

- `POST /twilio/status`
- orchestrator maps Twilio statuses to internal statuses
- orchestrator updates durable call state by calling `call-write`

Twilio recording completion callback hits:

- `POST /twilio/recording-status`
- orchestrator updates `calls.recording_url` through `call-write`

### 4. Media stream

Once Twilio opens the websocket, `orchestrator/src/ws/media-stream.ts` becomes the runtime center of gravity.

It:

- reads custom parameters from the Twilio stream start event
- resolves the agent by:
  - explicit `agentId`
  - phone-number lookup through `agent-config`
  - fallback-first active agent through `agent-config`
- performs optional inbound CRM lookup via `crm-lookup`
- builds runtime variables including `location_link` and `form_link`
- writes the initial `calls` row via `call-write`
- subscribes to realtime changes on:
  - `sms_messages`
  - `calls`

The media-stream handler therefore owns the live runtime loop, but it still depends on Supabase for config lookup, writeback, and realtime event injection.

### 5. OpenAI interaction

The same media-stream handler opens a direct websocket to OpenAI Realtime:

- configures session instructions, tools, greeting, voice, and audio format
- forwards caller audio from Twilio to OpenAI
- forwards model audio from OpenAI back to Twilio
- handles runtime tools such as:
  - `end_call`
  - `lookup_vehicle`
  - `send_sms`

Tool side effects are mixed:

- `lookup_vehicle` calls `crm-lookup`
- `send_sms` calls Twilio REST directly from orchestrator
- outbound SMS persistence uses direct anon REST insert to `sms_messages`

### 6. Writeback path

Durable writeback happens through multiple channels:

- call lifecycle writes usually go through `supabase/functions/call-write`
- inbound SMS rows are inserted by `supabase/functions/twilio-sms-inbound`
- outbound SMS rows from orchestrator are inserted directly through Supabase REST using the anon key
- some legacy voice edge functions still write directly to `calls` and `call_events`

Primary current writeback path for the canonical runtime:

- `orchestrator/` -> `call-write` -> `calls` / `call_events`

But it is not the only write path currently present in the repo.

### 7. Recording path

Current recording flow:

1. Orchestrator asks Twilio to emit recording callbacks.
2. `POST /twilio/recording-status` stores the recording URL in `calls`.
3. UI playback uses `src/lib/recording.ts` to proxy Twilio URLs through `supabase/functions/recording-proxy`.
4. Admin recovery can run `supabase/functions/twilio-recording-backfill` to patch missing recording URLs.

This means live recording ownership is runtime-plane first, but playback and recovery remain Supabase helper responsibilities.

### 8. Status and event path

Current live status/event sources:

- Twilio voice callback -> orchestrator `/twilio/voice`
- Twilio status callback -> orchestrator `/twilio/status`
- Twilio recording callback -> orchestrator `/twilio/recording-status`
- Twilio inbound SMS webhook -> `supabase/functions/twilio-sms-inbound`
- browser form submit -> `supabase/functions/form-submit`
- browser location confirm -> `supabase/functions/location-confirm`

The media-stream handler listens to durable `calls` and `sms_messages` changes and converts those changes back into live AI prompts. That means some runtime events are re-entering the call through the data plane instead of a direct runtime callback path.

### 9. Final durable storage path

At call end:

- orchestrator finalizes the call in `calls`
- orchestrator stores transcript in `calls.transcript`
- orchestrator triggers post-call analysis through `ai-completion`
- analysis result lands in `calls.summary`
- post-call SMS templates may be sent and persisted in `sms_messages`
- call logs and dashboards read from `calls`, `call_events`, and `sms_messages`

Durable system of record:

- Supabase/Postgres

## Where Overlap Still Exists

### Runtime overlap

The repo still contains older voice runtime functions:

- `calls-start`
- `twilio-voice`
- `twilio-status`
- `openai-realtime-session`
- `openai-realtime-status`

These overlap with the canonical runtime path in `orchestrator/`, even though the frontend now prefers orchestrator for live calls.

### Public capture overlap

Two public flows have dual implementations:

- location confirmation
  - current page uses `supabase/functions/location-confirm`
  - orchestrator also exposes `/api/location/confirm`
- form submit
  - current page uses `supabase/functions/form-submit`
  - orchestrator also exposes `/api/forms/iizi-fallback`

These are not equal runtime planes, but they do create ambiguous backend ownership for live-call-adjacent data capture.

### Writeback overlap

Current durable writes happen through:

- `call-write`
- direct edge-function DB writes
- direct anon REST writes from orchestrator

The canonical runtime is singular, but the durable write method is not.

## Where Legacy Supabase Voice Functions Sit In The Lifecycle

| Legacy function | Lifecycle position | Current role |
|---|---|---|
| `calls-start` | Alternative step 2 outbound start path | Transitional duplicate |
| `twilio-voice` | Alternative step 3 voice webhook | Transitional duplicate |
| `twilio-status` | Alternative step 8 status callback | Transitional duplicate |
| `openai-realtime-session` | Alternative OpenAI session bootstrap outside canonical call runtime | Transitional duplicate |
| `openai-realtime-status` | Companion config/status check for the duplicate session path | Transitional duplicate |

## Runtime Ownership Ambiguities Today

1. Orchestrator is the canonical runtime, but still cannot complete core runtime reads/writes without Supabase helper functions.
2. Inbound SMS enters through a Supabase function, then re-enters the live call through realtime subscriptions watched by orchestrator.
3. Location and form confirmations are live-call-adjacent, but their active public path is browser -> Supabase edge function rather than browser -> orchestrator.
4. Post-call analysis is triggered from orchestrator but executed in an edge function.
5. Recording live callback, recording proxy, and recording backfill are split across different owners.

## Intended Canonical Lifecycle

The intended lifecycle under the architecture lock should read as:

1. `src/` triggers call actions and displays durable state.
2. `orchestrator/` owns all synchronous live-call execution and provider callbacks.
3. Supabase/Postgres owns durable data and audit history.
4. Supabase edge functions remain only where a narrow helper is justified:
   - trusted utility
   - admin backfill
   - explicit compatibility bridge
5. No second voice-runtime narrative should remain in docs or implementation planning.

## Validation Checks

- Every major current call stage from UI trigger to final durable storage is documented here end to end.
- Overlap and legacy function placement are called out explicitly rather than implied.
- This document changes no runtime behavior and describes only current implementation plus intended future ownership.
