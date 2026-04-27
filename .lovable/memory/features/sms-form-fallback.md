---
name: SMS form fallback
description: Public /form page lets caller submit reg-no + callback phone during a live call. Mirrors location flow.
type: feature
---
# SMS Form Fallback

When a caller can't say their car registration number or a callback phone clearly, the AI sends an SMS with signed form links. Same pattern as `{{location_link}}`:

- **Page**: registration SMS uses the Railway orchestrator route `/api/forms/reg?caseId=<UUID>&token=<HMAC>` and shows only one registration-number input. Callback SMS uses `/form?caseId=<UUID>&token=<HMAC>&mode=phone` (src/pages/FormSubmit.tsx).
- **Edge function**: `form-submit` (validates HMAC with `LOCATION_TOKEN_SECRET`, writes to `calls`)
- **DB columns**: `form_registration_number`, `form_callback_phone_number`, `form_submitted_at`, `form_submission_source`, `form_raw`
- **AI integration**: orchestrator subscribes to `calls` UPDATE — when `form_submitted_at` changes it injects a system message so AI reads values back to caller
- **Token**: same HMAC-SHA256(callId, LOCATION_TOKEN_SECRET) as location — one shared secret
- **Base URL**: orchestrator builds `form1_link` / legacy `form_link` as `PUBLIC_BASE_URL` + `/api/forms/reg` for registration-only collection. `form2_link` remains the callback-phone page using `LOCATION_PAGE_BASE_URL` + `/form?mode=phone`. Legacy `GOOGLE_FORM_BASE_URL` is a fallback only.
