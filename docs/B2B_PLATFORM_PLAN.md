# B2B Platform Plan

## Purpose

This document locks architecture ownership before further implementation work. It is documentation only. It does not change application code, orchestrator logic, schema, or deployment.

The primary objective of Milestone 1 is to remove ambiguity about which stack is authoritative.

## Milestone 1 Outcome

After this milestone, the repo should be interpreted as follows:

- `orchestrator/` is the canonical execution and runtime plane.
- Supabase/Postgres is the durable data plane and system of record.
- `src/` is the control plane for operator and admin workflows.
- overlapping Supabase voice runtime functions are transitional or legacy candidates, not equal-primary runtime owners.

## Current State

The repo already behaves like an early B2B voice platform, but its ownership boundaries are still transitional:

- `src/` provides the operator/admin product surfaces.
- the frontend already calls the orchestrator for live call start behavior
- `orchestrator/` already handles the real-time Twilio/OpenAI voice path
- Supabase stores the core business records and operational tables
- `supabase/functions/` still contains both control/data utilities and older voice runtime endpoints

This mixed state is operationally workable, but it is not acceptable as an architecture source of truth because it suggests multiple equal runtime backends.

## Authoritative Platform Shape

### Control Plane

Definition:

- the control plane owns configuration, operator workflows, support workflows, dashboards, and administrative actions

Repo scope:

- `src/`
- selected trusted Supabase functions used for control-plane utilities

Examples:

- agent and campaign management
- organization settings
- feature flags
- health dashboards
- API/configuration surfaces

### Runtime Plane

Definition:

- the runtime plane owns synchronous live-call execution and external provider coordination

Canonical owner:

- `orchestrator/`

Responsibilities:

- outbound call initiation
- Twilio voice webhooks
- Twilio status callbacks
- media stream lifecycle
- OpenAI Realtime session lifecycle
- runtime-safe call/event writeback coordination

Authoritative rule:

- if the behavior must respond in real time to a live call, Twilio callback, websocket media event, or provider session lifecycle, it belongs in `orchestrator/`

### Data Plane

Definition:

- the data plane owns durable storage, schema, policies, auditability, and reporting inputs

Canonical owner:

- Supabase/Postgres

Repo scope:

- `supabase/migrations/`
- database tables, policies, and durable records

Examples:

- `calls`
- `call_events`
- `agents`
- `campaigns`
- `organization_settings`
- `provider_status`
- `feature_flags`
- `incident_log`

Authoritative rule:

- if the concern is durable state, queryability, policy enforcement, migration control, or audit-grade history, it belongs in Supabase/Postgres

## Backend Ownership Model

The backend is owned by capability, not by whichever service already has a nearby function.

- `orchestrator/` owns runtime execution
- Supabase/Postgres owns durable data
- selected Supabase functions may support control-plane or narrow helper tasks
- `src/` owns operator-facing control-plane UX

This means the platform does not have two equal runtime stacks.

## Transitional And Legacy Runtime Candidates

The following Supabase functions overlap with the orchestrator runtime path and must be treated as transitional or legacy candidates:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

These endpoints may still exist for compatibility, bridging, or staged migration reasons, but they are not equal-primary runtime architecture.

They must not be used to justify continued dual ownership of live voice behavior.

## Target State

The target state is a clean B2B platform with one clear owner per plane:

- control plane: React/Lovable admin app plus selected trusted utilities
- runtime plane: `orchestrator/`
- data plane: Supabase/Postgres

The target state also assumes:

- one canonical call lifecycle
- one runtime execution path
- one durable system of record
- one access-control strategy suitable for B2B tenancy

## Phased Roadmap

### Phase 0: Architecture Lock

- publish and maintain these docs as the current source of truth
- stop documenting the Supabase voice runtime and orchestrator runtime as peers
- require future implementation work to declare plane ownership first

### Phase 1: Control Plane Hardening

- keep operator UX and configuration work in `src/`
- keep trusted admin helpers narrow in scope
- avoid backend-runtime ownership drift through UI-driven changes

### Phase 2: Runtime Plane Consolidation

- continue converging live voice behavior into `orchestrator/`
- narrow or retire overlapping voice-oriented Supabase functions in later milestones
- keep compatibility bridges explicit and temporary

### Phase 3: Data Plane Maturity

- keep Supabase/Postgres as the durable system of record
- tighten migration and policy discipline
- standardize durable event/write expectations for support and reporting

### Phase 4: B2B Hardening

- formalize tenant boundaries and operator access
- standardize support and incident workflows around durable records
- align product surfaces to the locked plane model

## Milestone Execution Order

### Milestone 1: Architecture Lock

- complete documentation updates only
- declare `orchestrator/` as canonical runtime
- declare Supabase/Postgres as durable data plane
- mark overlapping Supabase voice runtime functions as transitional or legacy candidates

Exit criteria:

- contributors can identify the authoritative control, runtime, and data plane without reading code

### Milestone 2: Ownership Lock

- require each major capability to have one primary owner plane
- prevent new runtime behavior from being implemented in parallel stacks
- publish the backend ownership, lifecycle, and table-access inventories:
  - [BACKEND_OWNERSHIP_MATRIX.md](/home/henri/code/voice-loom-bot/docs/BACKEND_OWNERSHIP_MATRIX.md)
  - [CALL_LIFECYCLE_MAP.md](/home/henri/code/voice-loom-bot/docs/CALL_LIFECYCLE_MAP.md)
  - [TABLE_ACCESS_AND_TENANCY_INVENTORY.md](/home/henri/code/voice-loom-bot/docs/TABLE_ACCESS_AND_TENANCY_INVENTORY.md)

### Milestone 3: Access And Tenancy Hardening

- redesign preview-style access toward B2B-grade policies
- make tenant and operator scope explicit

### Milestone 4: Runtime Convergence

- narrow or retire duplicate Supabase voice runtime paths
- keep only justified helper or bridge functions outside the orchestrator

### Milestone 5: Operational Maturity

- standardize event and status semantics
- ensure support and reporting rely on durable data-plane facts

## Immediate Rules For Future Work

1. Treat `orchestrator/` as the only canonical runtime plane.
2. Treat Supabase/Postgres as the durable source of truth.
3. Treat `src/` as the control-plane UI.
4. Treat overlapping Supabase voice runtime functions as transitional or legacy candidates.
5. Do not describe the orchestrator and Supabase voice runtime as equal-primary in docs, planning, or implementation proposals.

## Risks If This Is Ignored

- duplicated runtime behavior will continue to drift
- debugging and incident ownership will remain ambiguous
- contributors will keep reinforcing two competing runtime narratives
- support and reporting semantics will remain unstable
- B2B hardening work will be harder because the platform boundary is unclear
