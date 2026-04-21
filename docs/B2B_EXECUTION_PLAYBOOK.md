# B2B Execution Playbook

## Purpose

This playbook defines the execution order and ownership rules that follow from the Milestone 1 architecture lock. It is documentation only.

Use it to decide:

- where work belongs
- what should happen next
- what should not be expanded
- how to avoid reintroducing dual-runtime ambiguity

## Authoritative Execution Model

The authoritative execution model for this repository is:

- one control plane: `src/` plus selected trusted Supabase utilities
- one runtime plane: `orchestrator/`
- one durable data plane: Supabase/Postgres

This is the operating model even though some overlapping Supabase voice runtime functions still exist in the repo.

## Plane Responsibilities

### Control Plane

Owns:

- operator workflows
- admin configuration
- settings and health surfaces
- internal dashboards and support tooling

Primary surfaces:

- `src/`
- selected non-runtime Supabase functions

### Runtime Plane

Owns:

- outbound call execution
- Twilio webhook handling
- media stream handling
- OpenAI Realtime lifecycle
- runtime callback coordination

Primary surface:

- `orchestrator/`

### Data Plane

Owns:

- durable records
- migrations
- policies and access boundaries
- audit and reporting inputs

Primary surface:

- Supabase/Postgres

## Transitional Runtime Components

The following Supabase functions overlap with the canonical runtime path and must be treated as transitional or legacy candidates:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

Execution rule:

- they may exist during transition, but they are not equal-primary runtime authority and should not be expanded as if they were

## Execution Rules

### Rule 1

- if the change affects live call execution, Twilio callbacks, streaming, or provider session lifecycle, it belongs in `orchestrator/`

### Rule 2

- if the change affects durable storage, migrations, policies, or support/reporting history, it belongs in Supabase/Postgres

### Rule 3

- if the change affects admin UX, operator configuration, or dashboards, it belongs in `src/`

### Rule 4

- do not add new live voice runtime behavior to overlapping Supabase voice functions

### Rule 5

- do not document the runtime as if Supabase voice functions and `orchestrator/` are peers

### Rule 6

- do not use Lovable-driven UI work as authority for backend architecture decisions

## Milestone Order

### Milestone 1: Architecture Lock

Goal:

- remove ambiguity and establish the canonical stack in docs

Actions:

- align all high-level docs to the same ownership model
- state explicitly that `orchestrator/` is canonical runtime
- state explicitly that Supabase/Postgres is canonical durable data plane
- classify overlapping Supabase voice runtime functions as transitional or legacy candidates

Exit criteria:

- contributors can answer control-plane vs runtime-plane vs data-plane ownership before implementation starts

### Milestone 2: Ownership Lock

Goal:

- require every major capability to have a single primary owner

Actions:

- assign runtime work to `orchestrator/`
- assign durable data work to Supabase/Postgres
- assign operator UX work to `src/`

Exit criteria:

- no implementation proposal describes two equal owners for the same capability

### Milestone 3: Access Hardening

Goal:

- align policies and tenancy to the locked plane model

Actions:

- audit anon exposure
- define tenant scope
- define operator and support access expectations

### Milestone 4: Runtime Convergence

Goal:

- reduce the implementation gap between the canonical runtime model and the remaining transitional code

Actions:

- narrow or retire overlapping voice functions
- keep only justified helper or bridge functions outside `orchestrator/`

### Milestone 5: Operational Maturity

Goal:

- make support, reporting, and incident workflows depend on stable durable data

Actions:

- standardize call and event semantics
- align health and incident surfaces with canonical ownership

## Practical Decision Tests

Ask these questions before implementation:

1. Is this a control-plane change, a runtime-plane change, or a data-plane change?
2. If it is runtime, why is it not in `orchestrator/`?
3. If it is durable data, why is it not represented in Supabase/Postgres?
4. If it is a UI workflow, why is it not treated as control-plane work?
5. Does this proposal accidentally treat legacy Supabase voice functions as co-primary runtime components?

## Anti-Patterns

- adding runtime behavior to both `orchestrator/` and `supabase/functions/`
- treating transitional voice functions as permanent runtime owners
- building docs that preserve ambiguity about the authoritative stack
- planning B2B access hardening before clarifying execution ownership
- allowing operational dashboards to imply backend ownership that the platform has not formally assigned
