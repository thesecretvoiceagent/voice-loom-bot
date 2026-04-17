
The user asks two things:

1. **How does the AI know which SMS to send when?** — explain the current mechanism and improve it.
2. **AI reads SMS replies** — when a customer texts back (e.g. with a callback number or a what3words location), the AI should be able to read that reply mid-call and use it (e.g. read the number back to confirm).

Let me check current state of orchestrator/media-stream and CreateAgent SMS section to design properly.

Key observations from earlier context:
- Each SMS template has: `name`, `content`, `trigger` (during/after), `order`.
- Orchestrator injects an "AVAILABLE SMS TEMPLATES" block into the system prompt and exposes `send_sms({template_name})` tool.
- After-call SMSes are sent in order automatically at hangup.

So question (1) answer = combination of:
- The **template name** + **trigger** is what tells the AI which one to use.
- "During call" templates require explicit AI trigger via `send_sms` (chooses by name).
- "After call" templates fire automatically in `order` at hangup.

To make it actually work reliably, the prompt injection needs to also include each template's **purpose/when-to-use** description so the AI picks the right one. Currently we only inject name + content. I'll add a `description` (when-to-use) field to each SMS template.

For (2), inbound SMS reading:
- Need a Twilio inbound SMS webhook → edge function that stores incoming SMS in a new `sms_messages` table linked to `call_id` (matched by from/to phone within recent call window).
- Orchestrator polls / subscribes to new SMS for the active call and injects the reply text into the realtime AI session as a system message ("📱 Customer replied via SMS: 'My number is 555-1234'").
- Configure Twilio number's "A Message Comes In" webhook to point at this new edge function.

# Plan

## 1. How AI picks the right SMS (explainer + improvement)

**Today**: AI sees a list of SMS templates by `name` + `content`. To send one mid-call it calls `send_sms({template_name: "location_link"})`. After-call SMSes fire automatically in their `order`.

**Improvement**: Add a **"When to use"** field (description) to each SMS template so the AI knows *when* to trigger which template — not just *what's in it*.

### UI changes (`src/pages/CreateAgent.tsx`)
- Add `description` field to each SMS card (textarea, e.g. *"Send when customer asks for location confirmation link"*).
- Migrate existing entries (default `description: ""`).

### Orchestrator changes (`orchestrator/src/ws/media-stream.ts`)
- Inject `description` into the system prompt block:
  ```
  AVAILABLE SMS TEMPLATES:
  - location_link (trigger: during call) — When to use: customer needs the location form link
    Content: "Kinnitage oma asukoht: https://what3words.com/..."
  - thanks (trigger: after call, order 1) — When to use: automatic thank-you
  ```
- Tool description for `send_sms` updated to instruct: "Pick `template_name` based on the 'When to use' guidance."

## 2. AI reads incoming SMS replies

```text
Customer ──SMS──▶ Twilio ──webhook──▶ edge fn `twilio-sms-inbound`
                                            │
                                            ├─ insert into sms_messages (direction=inbound)
                                            │
                                            └─ Postgres realtime ──▶ orchestrator
                                                                          │
                                                                          ▼
                                                          inject as system msg into
                                                          OpenAI Realtime session
                                                          ("📱 Customer replied: ...")
```

### Database (migration)
New table `sms_messages`:
- `id`, `call_id` (nullable FK to calls), `agent_id`, `template_name` (nullable, only for outbound), `direction` ('inbound' | 'outbound'), `from_number`, `to_number`, `body`, `twilio_sid`, `status`, `created_at`.
- Enable realtime publication on this table.
- RLS: authenticated can SELECT; anon/service can INSERT/UPDATE.

### Outbound SMS persistence (`orchestrator/src/ws/media-stream.ts`)
- After successfully sending an SMS via Twilio, insert a row into `sms_messages` with `direction='outbound'`, link to `call_id`.

### New edge function `supabase/functions/twilio-sms-inbound/index.ts`
- Receives Twilio SMS webhook (form-urlencoded: `From`, `To`, `Body`, `MessageSid`).
- Looks up the most recent **active** call where `from_number = From` (within last 30 min).
- Inserts row into `sms_messages` with `direction='inbound'`, `call_id`, `body`.
- Returns empty TwiML (no auto-reply).
- `verify_jwt = false` in `supabase/config.toml`.

### Orchestrator subscription (`orchestrator/src/ws/media-stream.ts`)
- On call start, subscribe via Supabase realtime to `sms_messages` rows where `call_id = currentCallId` AND `direction='inbound'`.
- On new inbound SMS:
  - Send a `conversation.item.create` system message into the OpenAI Realtime WS:
    > "📱 Customer just replied via SMS: 'They wrote: <body>'. Acknowledge what they sent and confirm it back to them in the conversation."
  - Trigger `response.create` to make the AI speak immediately.
- Unsubscribe at call end.

### User setup (post-deploy instructions)
- In Twilio console → phone number → **Messaging** → "A Message Comes In" → set to:
  `https://dtctqwoesbvntdpeekgv.supabase.co/functions/v1/twilio-sms-inbound` (POST).

## 3. Optional: SMS log on call detail page (not in this round unless you ask)

## Files to touch
- migration: create `sms_messages` table + realtime + RLS
- `supabase/functions/twilio-sms-inbound/index.ts` (new)
- `supabase/config.toml` (function block, `verify_jwt = false`)
- `orchestrator/src/ws/media-stream.ts` (description in prompt, persist outbound, subscribe to inbound)
- `src/pages/CreateAgent.tsx` (add `description` field per SMS)

## Twilio webhook URL you'll need to set
`https://dtctqwoesbvntdpeekgv.supabase.co/functions/v1/twilio-sms-inbound`

Approve and I'll build it.
