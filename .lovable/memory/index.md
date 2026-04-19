---
name: index
description: Project memory index
type: reference
---
# Project Memory

## Core
- Platform scope strictly excludes AI agent scripts/logic (Client's responsibility).
- Dark theme with BeyondCode brand colors: magenta-to-cyan gradients, neon glow.
- RBAC with 6 roles enforced server-side via Supabase RLS.
- Soft-delete by default, hard-delete admin only. All CRUD persists to DB.
- UI calls external Node.js orchestrator only; no direct Twilio/OpenAI SDK calls from frontend.
- API keys stored securely in `organization_settings` with RLS; never exposed in UI.
- AI constrained to approved scripts; no autonomous legal judgments.
- Hard data separation between Estonia (EE) and Finland (FI) deployments.

## Memories
- [SMS Form Fallback](mem://features/sms-form-fallback) — /form page for reg-no + callback phone, mirrors location flow
- [Platform Scope](mem://project/platform-scope-exclusions) — Contractual constraints regarding AI agent content and scope
- (other entries unchanged — see prior index)
