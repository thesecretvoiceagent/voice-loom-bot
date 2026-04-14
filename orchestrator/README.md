# VoiceLoom Orchestrator

Railway-deployed Node.js service that bridges **Twilio Media Streams** ↔ **OpenAI Realtime API** for live AI voice calls.

## Architecture

```
Phone Call → Twilio → Media Stream WS → THIS SERVER → OpenAI Realtime WS
                                              ↕
                                          Supabase (call state)
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check + provider status |
| `/api/calls/start` | POST | Initiate outbound call via Twilio |
| `/twilio/voice` | POST | Twilio voice webhook (returns TwiML) |
| `/twilio/status` | POST | Twilio status callback |
| `/twilio/stream` | WSS | Twilio Media Stream WebSocket bridge |

## Local Development

```bash
cp .env.example .env
# Fill in your keys
npm install
npm run dev
```

## Deploy to Railway

1. Create a new Railway service pointing to `/orchestrator`
2. Set environment variables from `.env.example`
3. Set `PUBLIC_BASE_URL` and `PUBLIC_WS_BASE_URL` to your Railway domain
4. Railway auto-detects the Dockerfile

## Environment Variables

See `.env.example` for all required variables.
