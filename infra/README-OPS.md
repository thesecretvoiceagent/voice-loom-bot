# Operations Runbook

## Milestone 1 Scope

This runbook reflects the documentation-only architecture lock.

- no app code changes
- no orchestrator logic changes
- no schema changes
- no deployment changes

Its purpose is to document the authoritative operating model clearly enough that future implementation and ops work stop following conflicting assumptions.

## Canonical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTROL PLANE: `src/`                        │
│         Operator UX, settings, dashboards, admin workflows       │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ control/config requests
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RUNTIME PLANE: `orchestrator/`                  │
│  Canonical live-call execution, Twilio webhooks, media streams,  │
│              OpenAI Realtime sessions, runtime callbacks         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ durable writeback / reads
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                DATA PLANE: Supabase / Postgres                   │
│   Durable records, schema, policies, audit history, reporting    │
└─────────────────────────────────────────────────────────────────┘
```

## Operational Interpretation

### Control Plane

Primary owner:

- `src/`

Responsibilities:

- settings and health pages
- operator workflows
- support/admin surfaces
- runtime endpoint selection via control-plane configuration such as `organization_settings.orchestrator_url`

### Runtime Plane

Primary owner:

- `orchestrator/`

Responsibilities:

- call initiation
- Twilio voice and status webhooks
- websocket media stream handling
- OpenAI Realtime provider coordination
- runtime callbacks and live execution flow

This is the canonical execution path.

### Data Plane

Primary owner:

- Supabase/Postgres

Responsibilities:

- durable call and event records
- schema and migrations
- policy and access boundaries
- provider health, incidents, feature flags, and configuration state

This is the canonical durable system of record.

## Transitional And Legacy Runtime Candidates

The following Supabase functions overlap with runtime responsibilities and must be treated as transitional or legacy candidates:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

Ops interpretation:

- they may still exist in the repo
- they are not equal-primary with `orchestrator/`
- future runtime expansion should not be planned around them

## Current Verification Focus

Milestone 1 does not change runtime behavior. It changes the authoritative interpretation of the platform.

Operationally, this means:

- runtime issues should be reasoned about from the orchestrator-first execution path
- durable state questions should be reasoned about from Supabase/Postgres
- admin/configuration questions should be reasoned about from the control-plane UI

## Deployment Posture

This document does not introduce a new deployment process.

The architecture ownership that future deployment and verification work should assume is:

1. control plane: frontend/admin surface
2. runtime plane: orchestrator service
3. data plane: Supabase/Postgres

## Practical Ops Rules

1. Do not describe Supabase voice functions as co-primary runtime services.
2. Do not plan incident ownership around two competing runtime stacks.
3. Do not treat control-plane configuration as proof of shared runtime authority.
4. Do not treat durable data ownership and runtime execution ownership as the same thing.

## Tables And Records To Treat As Durable Data-Plane Facts

- `calls`
- `call_events`
- `provider_status`
- `feature_flags`
- `incident_log`
- `agents`
- `campaigns`
- `organization_settings`

## Risks To Watch

- stale ops assumptions from edge-function-first docs
- split incident debugging between legacy endpoints and canonical runtime behavior
- config drift around `orchestrator_url`
- B2B access hardening work starting before ownership boundaries are applied consistently
