# Table Access And Tenancy Inventory

## Scope

This inventory focuses on the core backend tables that affect runtime safety, browser-direct CRUD, and future tenant hardening. Ratings are relative to the current repo state, not to a future B2B target state.

Cross-links:

- [BACKEND_OWNERSHIP_MATRIX.md](BACKEND_OWNERSHIP_MATRIX.md)
- [CALL_LIFECYCLE_MAP.md](CALL_LIFECYCLE_MAP.md)

## Table Inventory

| Table | Purpose | Current access pattern | Current apparent ownership model | Tenant sensitivity | Browser-direct access exists | Anon access exists or is suspected | Should remain browser-direct | Notes on future tenant hardening |
|---|---|---|---|---|---|---|---|---|
| `agents` | Agent config, prompts, tools, runtime settings, phone number | Browser CRUD from `useAgents`, `CreateAgent`, quick-test dialogs; runtime lookup via `agent-config` | Mixed control-plane CRUD + runtime lookup | High | Yes | Yes, explicit full anon CRUD policy | No | Highest-priority hardening target. Runtime depends on it and anon CRUD currently exists. |
| `agent_flows` | Visual per-agent flow graph | Browser CRUD from `useAgentFlow`; currently not a runtime owner | Control-plane | Medium | Yes | Yes, explicit full anon CRUD policy | Probably temporarily, but authenticated-only | Flow data is operator config; anon full CRUD is a clear temporary exposure. |
| `campaigns` | Campaign metadata and linkage to agent | Browser CRUD from pages/hooks | Control-plane | Medium | Yes | Yes, explicit full anon CRUD policy | Probably temporarily, but authenticated-only | Campaigns are not tenant-scoped yet beyond `user_id`; current policies allow broad reads and anon writes. |
| `calls` | Durable call record and live-call writeback target | Browser read/delete, orchestrator write via `call-write`, legacy edge direct writes, realtime subscriptions, public capture updates | Mixed runtime writeback + browser read surface | High | Yes | Yes, explicit anon select/update/delete and earlier anon insert/update policies | Read: maybe temporarily. Write/delete: no | This is the most important durable runtime table. Current anon access was added to make realtime/public updates work and needs redesign. |
| `call_events` | Durable event trail for calls | Browser read, legacy edge write, `call-write` insert path | Data plane | High | Yes for reads | No explicit anon policy found | Read maybe temporarily | Event history should stay durable and likely server-written only. |
| `sms_messages` | Durable inbound/outbound SMS log tied to calls | Browser authenticated reads; inbound webhook insert; orchestrator anon REST insert; realtime subscription | Mixed runtime helper + durable log | High | Yes for authenticated reads | Yes, explicit anon insert/update/select/delete | Read maybe temporarily; direct anon mutation no | Needed for live-call SMS injection, but current anon write/select footprint is broad. |
| `organization_settings` | Per-user org config, API keys, webhook secrets, orchestrator URL | Browser direct read/update/insert, edge helper for key generation | Control-plane config | High | Yes | Yes, explicit anon view/insert/update policy | Partially | Secrets should remain browser-readable only through authenticated scoped paths; anon policies are not acceptable long term. |
| `feature_flags` | Global/env/tenant flags and kill switches | Browser direct reads and writes via `featureFlagService` | Data/control-plane shared | Medium | Yes | Yes, explicit anon select policy | Read maybe temporarily; writes should be privileged | Current RLS allows authenticated reads and admin writes, but anon read exists and the browser mutates durable flags directly. |
| `provider_status` | Durable provider health and circuit state | Browser reads and writes via `circuitBreakerService`; edge writes via `ops-health-run` | Data plane with shared mutators | Medium | Yes | Yes, explicit anon select policy | Read maybe temporarily; writes no | Provider state should likely be server-managed only. Browser-side circuit mutation is operationally risky. |
| `incident_log` | Human-readable operational incidents | Browser read/write via `incidentService` | Data plane / ops log | Medium | Yes | Yes, explicit anon select policy | Read maybe temporarily; writes should be constrained | Today browser code can insert incidents directly; future hardening should distinguish operator notes from system incidents. |
| `crm_vehicles` | Knowledge base / CRM lookup for inbound bot | Browser CRUD via `KnowledgeBaseTable`; runtime lookup via `crm-lookup` | Mixed control-plane CRUD + runtime lookup | High | Yes | Yes, explicit anon select policy | Browser CRUD maybe for admins only | Contains customer/vehicle PII and is used in live runtime decisions. |
| `idempotency_keys` | Webhook/job dedupe state | Server-side access from legacy `twilio-status` | Data plane helper | Medium | No browser usage found | No anon policy found | No | Should stay server-only. Current policy wording allows authenticated management, but practical use is service-side. |
| `audit_logs` | Auth/org security audit trail | Written via auth trigger and `log_audit_event`; reads in admin contexts | Data plane / audit | High | Indirect admin read only | Yes, explicit anon select policy | No | Audit logs should be among the first tables to remove from anon visibility. |
| `item_audit_logs` | Item-level audit trail for non-core `items` module | Authenticated inserts, admin/auditor reads | Data plane / audit | Medium | Indirect app access likely | No anon policy found | No | Lower priority than `audit_logs`, but still should remain privileged-only. |
| `profiles` | User profile metadata | Browser reads own profile in `AuthContext` | Auth-adjacent | High | Yes | No explicit anon policy found | Yes, for own-profile access only | Current profile model is user-centric, not tenant-centric. |
| `user_roles` | App RBAC assignments | Browser reads own role in `AuthContext`; admins manage | Auth-adjacent | High | Yes | No explicit anon policy found | Limited read only | Role data should remain authenticated and likely admin-managed only. |
| `auth.users` | Supabase auth identities | Managed by Supabase auth; referenced by triggers/FKs | External auth system | High | No direct table access in app | Not applicable here | No | Tenant model will likely need org membership on top of auth identity. |

## Apparent Access Patterns By Area

### Browser-direct CRUD still active

The browser currently mutates durable tables directly for:

- `agents`
- `agent_flows`
- `campaigns`
- `organization_settings`
- `feature_flags`
- `provider_status`
- `incident_log`
- `crm_vehicles`
- `calls` delete actions

This is workable for preview/admin use, but it is not yet a hardened tenant model.

### Runtime-plane tables with public or anon exposure

The highest-risk runtime-adjacent tables are:

- `calls`
- `sms_messages`
- `agents`
- `organization_settings`
- `crm_vehicles`

Reasons:

- live-call execution depends on them
- some have explicit anon policies
- some are used both by browser CRUD and by runtime/server helpers

### Audit and auth-adjacent tables

Relevant audit/auth tables currently in scope:

- `profiles`
- `user_roles`
- `audit_logs`
- `item_audit_logs`

These are not part of the live call runtime, but they matter for Milestone 3 because current policies and data model are user-scoped rather than clearly tenant-scoped.

## Tables That Likely Need Hardening First

1. `calls`
2. `sms_messages`
3. `agents`
4. `organization_settings`
5. `crm_vehicles`

These tables combine tenant-sensitive data with active runtime or operational dependency.

## Temporary Browser-Direct Paths That May Be Acceptable During Transition

Potentially tolerable temporarily if tightly scoped:

- `agents` authenticated admin CRUD
- `agent_flows` authenticated owner CRUD
- `campaigns` authenticated owner CRUD
- `organization_settings` authenticated self-scope updates
- read-only operational dashboards over `calls`, `provider_status`, `incident_log`

Not acceptable as a long-term B2B target without redesign:

- anon CRUD or anon broad reads on tenant-sensitive tables
- browser-side writes to runtime state tables
- browser-side writes to provider circuit state
- browser-side writes to audit-grade incident records without tighter policy

## Milestone 3 Questions Raised By This Inventory

1. Which tables need an organization/tenant key added or enforced first?
2. Which browser-direct CRUD paths stay during transition, and which must move behind trusted helpers first?
3. How should realtime needs for `calls` and `sms_messages` be satisfied without permanent broad anon select policies?
4. Should runtime access to `agents` and `crm_vehicles` stay helper-based, or move to direct trusted DB access?
5. Which operational tables should become strictly server-managed even if the browser keeps read access?
