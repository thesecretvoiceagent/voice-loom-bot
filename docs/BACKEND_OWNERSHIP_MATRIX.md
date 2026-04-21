# Backend Ownership Matrix

## Scope

Milestone 2 is inventory and planning only. This document records the current backend surfaces found in the repo, the primary owner actually implementing each surface today, and the intended canonical owner under the Milestone 1 architecture lock.

Cross-links:

- [CALL_LIFECYCLE_MAP.md](CALL_LIFECYCLE_MAP.md)
- [TABLE_ACCESS_AND_TENANCY_INVENTORY.md](TABLE_ACCESS_AND_TENANCY_INVENTORY.md)
- [B2B_ARCHITECTURE_DECISIONS.md](B2B_ARCHITECTURE_DECISIONS.md)

## Capability Matrix

| Capability | Current implementation location | Primary owner today | Intended canonical owner | Status | Risk | Notes |
|---|---|---|---|---|---|---|
| Outbound call start | `src/services/orchestratorClient.ts`, `src/services/callService.ts`, `orchestrator/src/routes/calls.ts`; overlapping `supabase/functions/calls-start` | `orchestrator/` | `orchestrator/` | `keep` | High | Frontend already targets orchestrator `/api/calls/start`, but legacy edge function still exists and can place calls directly. |
| Twilio voice webhook handling | `orchestrator/src/routes/twilio-webhooks.ts` `POST /twilio/voice`; overlapping `supabase/functions/twilio-voice` | `orchestrator/` | `orchestrator/` | `keep` | High | Orchestrator returns canonical TwiML and passes call metadata into the media stream. Edge version points at a different websocket path and is legacy overlap. |
| Twilio status callback handling | `orchestrator/src/routes/twilio-webhooks.ts` `POST /twilio/status`; overlapping `supabase/functions/twilio-status` | `orchestrator/` | `orchestrator/` | `keep` | High | Orchestrator updates call state through `call-write`; legacy edge function still updates `calls` and `call_events` directly and adds idempotency behavior not mirrored in orchestrator. |
| Twilio recording handling | `orchestrator/src/routes/twilio-webhooks.ts` `POST /twilio/recording-status`; `src/lib/recording.ts`; `supabase/functions/twilio-recording-backfill` | Split between `orchestrator/` and Supabase edge functions | `orchestrator/` for live callback path, Supabase helper for admin backfill | `migrate` | High | Live recording callback is in orchestrator, playback proxy and backfill stay in Supabase, so recording ownership is currently split across planes. |
| Media stream handling | `orchestrator/src/ws/media-stream.ts`, websocket path `/twilio/stream` | `orchestrator/` | `orchestrator/` | `keep` | Medium | Canonical runtime core. Still depends on Supabase edge functions, realtime, and anon REST for several sub-steps. |
| OpenAI Realtime session handling | `orchestrator/src/ws/media-stream.ts`; overlapping browser + edge path `src/services/openaiRealtimeService.ts` -> `supabase/functions/openai-realtime-session` | `orchestrator/` for live calls, Supabase edge function for browser utility path | `orchestrator/` for voice runtime | `migrate` | High | Live calls use direct orchestrator-to-OpenAI websocket. Separate edge-function session creation remains in repo and preserves a second runtime story. |
| Post-call analysis | `orchestrator/src/ws/media-stream.ts` -> `supabase/functions/ai-completion` -> `call-write`/`calls` update | Shared: orchestrator triggers, Supabase edge function executes model call | Supabase/Postgres as durable result owner, likely orchestrator-triggered helper | `undecided` | Medium | Runtime trigger lives in orchestrator, analysis execution lives in edge function, durable writeback returns to `calls.summary`. |
| Agent config lookup | `orchestrator/src/supabase.ts` -> `supabase/functions/agent-config`; browser-direct CRUD on `agents` | Supabase edge function for runtime lookup | Supabase/Postgres data plane with a trusted helper or direct trusted DB access | `undecided` | High | Runtime cannot read agents directly today; it uses an edge function with service-role access while browser CRUD remains broad. |
| Call writeback | `orchestrator/src/supabase.ts` -> `supabase/functions/call-write`; direct anon REST insert for `sms_messages`; overlapping direct writes in legacy edge functions | Shared: orchestrator initiates, Supabase edge/helper executes | Supabase/Postgres | `undecided` | High | Orchestrator is canonical runtime but still writes through a bridge function rather than trusted DB access. SMS write path bypasses `call-write` and uses anon REST directly. |
| Form submit flow | Browser page `src/pages/FormSubmit.tsx` -> `supabase/functions/form-submit`; alternate `orchestrator/src/routes/forms.ts` | Supabase edge function | `orchestrator/` or a narrow Supabase helper, not both | `undecided` | High | Current public page uses edge function; orchestrator route exists for Google Form fallback. Same business effect, two public backends. |
| Location confirm flow | Browser page `src/pages/LocationConfirm.tsx` -> `supabase/functions/location-confirm`; alternate `orchestrator/src/routes/location.ts` | Supabase edge function | `orchestrator/` or a narrow Supabase helper, not both | `undecided` | High | Current public page uses edge function for both search and confirmation; orchestrator keeps a contract-compatible route. |
| Health checks | `orchestrator/src/routes/health.ts`; `supabase/functions/health-check`; `supabase/functions/ops-health-run`; `src/pages/SystemHealth.tsx` | Split | `orchestrator/` for runtime health, Supabase/Postgres for durable provider status | `undecided` | Medium | There are three health surfaces today: runtime readiness, edge-function external checks, and provider status persistence. |
| Provider status updates | `supabase/functions/ops-health-run`; `src/services/circuitBreakerService.ts`; `src/pages/SystemHealth.tsx` reads | Shared browser + edge function ownership over `provider_status` | Supabase/Postgres | `undecided` | High | Provider status is durable data, but both browser and edge/server code mutate it. |
| Recording proxy | `supabase/functions/recording-proxy`; `src/lib/recording.ts` | Supabase edge function | Supabase helper utility | `keep` | Medium | Narrow trusted helper with no runtime-plane conflict. |
| API key generation | `src/hooks/useOrganizationSettings.ts` -> `supabase/functions/generate-api-key` -> `organization_settings` + `audit_logs` | Supabase edge function | Supabase helper utility | `keep` | Low | Correctly behaves like a narrow trusted control-plane helper. |
| Inbound SMS handling | `supabase/functions/twilio-sms-inbound`; orchestrator subscribes to `sms_messages` realtime; orchestrator handles outbound SMS status/fallback routes | Supabase edge function for inbound webhook | `orchestrator/` runtime with Supabase durable storage, or explicit permanent split | `undecided` | High | Inbound SMS webhook is still outside the orchestrator, while live call logic in orchestrator depends on the inserted `sms_messages` rows. |

## Edge Function Inventory

Each current Supabase function is classified below against the locked architecture. `keep` means the function still fits as a narrow helper or admin utility. `migrate` means runtime ownership should move away from the function later. `retire` means the function is obsolete once newer paths are kept. `undecided` means the function is valid but its long-term placement is not yet locked.

| Function | Classification | Why |
|---|---|---|
| `agent-config` | `undecided` | Valid runtime dependency today, but it is a bridge from orchestrator to `agents` rather than a settled long-term ownership model. |
| `ai-completion` | `undecided` | Useful shared helper for post-call analysis and UI AI utilities, but still part of runtime-adjacent behavior triggered from orchestrator. |
| `call-write` | `undecided` | Central write bridge from orchestrator into durable storage; architecture question remains whether to keep a bridge or move to direct trusted DB access. |
| `calls-start` | `migrate` | Duplicates canonical outbound call start already implemented in orchestrator. |
| `crm-lookup` | `keep` | Narrow trusted helper around `crm_vehicles`; does not create a second runtime plane by itself. |
| `form-submit` | `undecided` | Public helper for SMS-linked data capture; overlaps with orchestrator route and needs an explicit long-term owner. |
| `generate-api-key` | `keep` | Narrow control-plane helper with auth and audit behavior. |
| `health-check` | `keep` | Narrow edge function for provider reachability checks used by the control plane. |
| `location-confirm` | `undecided` | Public helper used by the current page contract, but overlaps with orchestrator route. |
| `openai-realtime-session` | `migrate` | Preserves a second OpenAI realtime entry path outside the canonical runtime plane. |
| `openai-realtime-status` | `migrate` | Exists to support the separate browser-to-edge realtime story. |
| `ops-health-run` | `keep` | Durable provider-status updater fits the data/control-plane helper model. |
| `recording-proxy` | `keep` | Narrow proxy utility for authenticated recording playback. |
| `test-location-sms` | `keep` | Admin/test helper only; not a runtime owner. |
| `test-sms-template` | `keep` | Admin/test helper only; not a runtime owner. |
| `twilio-recording-backfill` | `keep` | Admin recovery/backfill helper with explicit operational scope. |
| `twilio-safelist-add` | `keep` | One-off admin utility; no runtime ownership conflict. |
| `twilio-sms-inbound` | `undecided` | Active inbound SMS webhook currently outside orchestrator while orchestrator depends on its durable outputs. |
| `twilio-status` | `migrate` | Duplicates canonical Twilio status handling already implemented in orchestrator. |
| `twilio-voice` | `migrate` | Duplicates canonical Twilio voice webhook handling already implemented in orchestrator. |

## Ownership Checks

### Major capability primary-owner check

Every major capability listed in this matrix has one primary owner assigned for the current state. Some capabilities still have a high-overlap note because a non-primary secondary implementation also exists in the repo.

### Highest-overlap areas found

1. Twilio voice/status/call-start paths exist in both `orchestrator/` and legacy edge functions.
2. Public SMS-linked capture flows exist both as browser -> edge function and as contract-compatible orchestrator routes.
3. Orchestrator runtime depends on Supabase through a mixed access model: edge functions, anon REST writes, and anon realtime subscriptions.
4. OpenAI Realtime appears in two narratives: canonical orchestrator voice runtime and a separate browser-facing edge-function session path.
5. Provider health/provider status is mutated by both browser code and server-side helpers.

## Open Decisions Before Milestone 3

1. Should orchestrator continue using `call-write` and `agent-config` as bridge helpers, or move to direct trusted DB access for runtime reads/writes?
2. Which public capture flows remain acceptable as browser -> edge function paths temporarily, and which should converge behind orchestrator endpoints?
3. Is inbound SMS a permanent Supabase webhook/helper role, or should it converge into orchestrator with a single Twilio runtime edge?
4. Should post-call analysis remain an edge helper invoked by orchestrator, or become a runtime-adjacent background job owned elsewhere?
5. Which browser-direct data-plane mutations are acceptable during transition, given the current anon policies on core tables?
