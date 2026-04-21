# B2B Architecture Decisions

## Scope

This document records the architecture decisions that are authoritative for the current repository. It is intentionally specific to the folders and services that exist now.

Milestone 1 is a documentation lock. It does not change code, schema, orchestrator logic, or deployment.

## Decision 1: The Platform Has Three Distinct Planes

Decision:

- the platform is organized into control plane, runtime plane, and data plane

Definitions:

- control plane: operator-facing configuration, workflows, health surfaces, and administrative actions
- runtime plane: real-time call execution and external provider coordination
- data plane: durable storage, schema, policies, audit history, and reporting inputs

Why:

- the repo already contains all three concerns
- prior docs blurred these concerns and allowed ownership drift

Implication:

- future work must first identify which plane owns the change

## Decision 2: `orchestrator/` Is The Canonical Runtime Plane

Decision:

- `orchestrator/` is the canonical execution and runtime plane

Why:

- the frontend already targets the orchestrator for live call start behavior
- the orchestrator already owns Twilio webhook handling, media streams, recordings, and OpenAI Realtime connectivity
- real-time provider coordination belongs in a dedicated runtime service, not in fragmented edge-function ownership

Repo evidence:

- `src/services/orchestratorClient.ts`
- `src/services/callService.ts`
- `orchestrator/src/routes/calls.ts`
- `orchestrator/src/routes/twilio-webhooks.ts`
- `orchestrator/src/ws/media-stream.ts`

Implication:

- runtime behavior for live voice should be designed around `orchestrator/`
- the repository does not have two equal-primary runtime backends

## Decision 3: Supabase/Postgres Is The Durable Data Plane

Decision:

- Supabase/Postgres is the durable data plane and system of record

Why:

- core operational entities already live there
- migrations and policies already define durable platform shape there
- support, analytics, and auditability depend on durable queryable records

Repo evidence:

- `supabase/migrations/`
- `calls`
- `call_events`
- `agents`
- `campaigns`
- `organization_settings`
- `provider_status`
- `feature_flags`
- `incident_log`

Implication:

- runtime services write back into Supabase/Postgres
- the orchestrator is not the long-term durable datastore

## Decision 4: `src/` Is The Control Plane Surface

Decision:

- `src/` is the primary control-plane surface for operators and admins

Why:

- the React app already provides the product/admin UX
- configuration and operational workflows belong in a control surface, not in the runtime service

Implication:

- UI and operator workflows should remain in `src/`
- control-plane work should not be mistaken for runtime ownership

## Decision 5: Overlapping Supabase Voice Functions Are Transitional Or Legacy Candidates

Decision:

- overlapping Supabase voice runtime functions are transitional or legacy candidates, not equal-primary runtime components

Functions in scope:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

Why:

- these functions overlap with runtime responsibilities already present in `orchestrator/`
- treating both stacks as first-class runtime owners creates rollout, debugging, and tenancy ambiguity

Implication:

- these functions may remain temporarily for compatibility or bridging
- future docs and implementation plans must not present them as peers to the orchestrator runtime

## Decision 6: Selected Edge Functions Still Have A Valid Role

Decision:

- Supabase edge functions may remain for narrow trusted helper tasks, but not as a second full runtime plane

Examples of acceptable scope:

- admin utilities
- key generation
- narrow write bridges
- helper lookups
- control-plane support tasks

Implication:

- the existence of useful edge functions does not change runtime ownership

## Decision 7: `organization_settings.orchestrator_url` Is A Control-Plane Configuration Mechanism

Decision:

- `organization_settings.orchestrator_url` is an accepted current-stage control-plane configuration mechanism

Why:

- it already exists and is used to direct the frontend toward a runtime endpoint

Implication:

- it is part of control-plane configuration, not evidence of shared runtime ownership
- later milestones should govern drift and environment consistency

## Decision 8: B2B Hardening Depends On This Ownership Lock

Decision:

- tenant and access hardening must proceed from the locked plane model above

Why:

- access redesign is much harder when runtime and data ownership are ambiguous
- B2B-grade controls require a clear source of truth for data and execution

Implication:

- policy and tenancy work should assume:
  - one control plane
  - one canonical runtime plane
  - one durable data plane

## Decision 9: Repo Documentation Must Reflect The Canonical Stack

Decision:

- repo documentation must describe the orchestrator-first runtime and Supabase-first data model consistently

Why:

- stale docs caused the repo to tell conflicting stories

Implication:

- root, ops, and service readmes must align with the same ownership model

## Canonical Summary

The authoritative architecture for this repository is:

- control plane: `src/` plus selected trusted Supabase utilities
- runtime plane: `orchestrator/`
- data plane: Supabase/Postgres

The repository is transitional in implementation, but not ambiguous in authority:

- `orchestrator/` is canonical for runtime execution
- Supabase/Postgres is canonical for durable data
- overlapping Supabase voice runtime functions are transitional or legacy candidates only

## Anti-Patterns

- describing Supabase voice functions and the orchestrator as co-primary runtime stacks
- putting new live-call runtime behavior outside `orchestrator/`
- treating convenient edge-function placement as architecture ownership
- using control-plane UI generation to make backend architecture decisions
- treating preview-era shortcuts as the long-term B2B model
