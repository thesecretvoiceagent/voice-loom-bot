---
name: agent-schedule-enforcement
description: How agent calling hours/days/timezone are enforced for inbound + outbound calls
type: feature
---
Agent `schedule` (start_time, end_time, days[], timezone) is enforced in the orchestrator:

- **Outbound** (`POST /api/calls/start`): blocks with `status: "out_of_schedule"` + a human-readable `error`. To override (e.g. emergency manual call), pass `variables.force_outside_schedule = "true"`.
- **Inbound** (`POST /twilio/voice` with no `callId`): looks up agent by called number (or explicit agentId), and if outside schedule returns polite TwiML ("outside business hours") + Hangup.

Logic: `orchestrator/src/schedule.ts` (mirrored in `src/lib/agentSchedule.ts`). Pure TS using `Intl.DateTimeFormat` — handles overnight windows (start > end), DST, and invalid timezones (falls back to UTC). Tested with 18 cases including DST transitions in Europe/Tallinn.

Defaults are permissive: missing schedule → allowed. Empty `days: []` → blocked.

UI: `ScheduleStatusBadge` on the Schedule tab shows live "Open now / Closed now · HH:MM DAY · TZ", refreshes every 30s. `QuickTestCallDialog` surfaces `out_of_schedule` as a warning toast (not error).
