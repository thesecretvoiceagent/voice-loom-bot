# VoiceLoom Orchestrator

`orchestrator/` is the canonical execution and runtime plane for the platform.

It is the authoritative service for live voice behavior. It is not a peer to the older Supabase voice runtime functions.

## Runtime Role

This service owns:

- outbound call initiation
- Twilio voice webhooks
- Twilio status callbacks
- Twilio media stream websocket handling
- OpenAI Realtime session and stream lifecycle
- runtime callback coordination before durable writeback

In the repo-wide architecture:

- control plane: `src/`
- runtime plane: `orchestrator/`
- data plane: Supabase/Postgres

## Relationship To Supabase

Supabase/Postgres remains the durable data plane and system of record.

The orchestrator executes live runtime behavior and writes or coordinates runtime outcomes back into durable data storage. It does not replace the data plane.

Selected Supabase functions may still exist for helper or bridge purposes, but overlapping voice runtime functions are transitional or legacy candidates rather than equal-primary runtime components.

## Transitional Overlap

The following Supabase functions overlap with this service's long-term runtime responsibility:

- `supabase/functions/calls-start`
- `supabase/functions/twilio-voice`
- `supabase/functions/twilio-status`
- `supabase/functions/openai-realtime-session`

They should be interpreted as transitional or legacy candidates during convergence work.

## Runtime Topology

```
Phone Call / UI Trigger
        │
        ▼
   `orchestrator/`
        │
        ├─► Twilio Voice + webhooks
        ├─► Twilio Media Streams
        ├─► OpenAI Realtime
        └─► Supabase/Postgres durable writeback
```

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health for the runtime plane |
| `/api/calls/start` | POST | Canonical outbound call initiation endpoint |
| `/twilio/voice` | POST | Canonical Twilio voice webhook |
| `/twilio/status` | POST | Canonical Twilio status callback |
| `/twilio/stream` | WSS | Canonical Twilio media stream bridge |

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

See `.env.example` for runtime configuration.

## Deployment Note

This README documents runtime ownership. It does not change deployment behavior as part of Milestone 1.
