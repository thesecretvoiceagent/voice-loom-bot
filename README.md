# Voice Loom B2B Platform

This repository is a multi-surface B2B voice platform in transition from preview-era patterns to a single authoritative architecture.

Milestone 1 locks ownership before implementation changes:

- `orchestrator/` is the canonical execution and runtime plane.
- Supabase/Postgres is the durable data plane and system of record.
- `src/` is the control-plane UI surface for operators and admins.
- overlapping Supabase voice runtime functions are transitional or legacy candidates, not equal-primary runtime paths.

## Plane Model

### Control Plane

Owns operator workflows, configuration, dashboards, and admin UX.

Primary repo surfaces:

- `src/`
- selected non-runtime Supabase functions used for trusted admin utilities

### Runtime Plane

Owns live call execution and provider coordination.

Primary repo surface:

- `orchestrator/`

Runtime responsibilities include:

- outbound call initiation
- Twilio webhooks
- media-stream lifecycle
- OpenAI Realtime session handling
- runtime writeback orchestration

### Data Plane

Owns durable state, schema, auditability, and reporting inputs.

Primary repo surfaces:

- `supabase/migrations/`
- Supabase/Postgres tables and policies

Durable records include:

- `calls`
- `call_events`
- `agents`
- `campaigns`
- `organization_settings`
- `feature_flags`
- `provider_status`
- `incident_log`

## Authoritative Stack

The authoritative stack for current and future implementation is:

1. `src/` for control-plane UI
2. `orchestrator/` for runtime execution
3. Supabase/Postgres for durable data

The following Supabase functions must be read as transitional or legacy runtime candidates until later convergence work removes or narrows them:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

They are not equal-primary with the orchestrator runtime path.

## Working Rules

- Do not add new live voice runtime behavior outside `orchestrator/`.
- Do not treat Supabase edge functions as a second full runtime stack.
- Do not treat Lovable-generated UI patterns as backend architecture authority.
- Do not change schema, orchestrator logic, or deployment posture as part of Milestone 1 documentation work.

## Key Documents

- [Platform plan](/home/henri/code/voice-loom-bot/docs/B2B_PLATFORM_PLAN.md)
- [Architecture decisions](/home/henri/code/voice-loom-bot/docs/B2B_ARCHITECTURE_DECISIONS.md)
- [Execution playbook](/home/henri/code/voice-loom-bot/docs/B2B_EXECUTION_PLAYBOOK.md)
- [Operations runbook](/home/henri/code/voice-loom-bot/infra/README-OPS.md)
- [Orchestrator runtime README](/home/henri/code/voice-loom-bot/orchestrator/README.md)
