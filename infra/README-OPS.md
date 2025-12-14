# Operations Runbook

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vite/React)                     │
│                    Deployed via Lovable Preview                   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                        │
│                      (Orchestrator Layer)                         │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ calls-start │  │ twilio-voice│  │ openai-realtime-session │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐ ┌──────────────────────────┐ │
│  │twilio-status│  │ops-health-run│ │ openai-realtime-status  │ │
│  └─────────────┘  └──────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────────┐
│    TWILIO    │    │   SUPABASE   │      │     OPENAI       │
│  Voice API   │    │   Database   │      │  Realtime API    │
└──────────────┘    └──────────────┘      └──────────────────┘
```

## Deployment Order

1. **Database (Auto)** - Supabase migrations run automatically
2. **Edge Functions (Auto)** - Deployed on code push via Lovable
3. **Frontend (Auto)** - Built and deployed via Lovable Preview

## Verification Steps

### 1. Verify Database
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Expected: provider_status, feature_flags, idempotency_keys, incident_log, etc.
```

### 2. Verify Edge Functions
Check each endpoint returns expected response:

```bash
# Health check
curl -X POST https://dtctqwoesbvntdpeekgv.supabase.co/functions/v1/health-check

# Ops health run (requires auth)
curl -X POST https://dtctqwoesbvntdpeekgv.supabase.co/functions/v1/ops-health-run \
  -H "Authorization: Bearer <anon_key>"

# Twilio config check
curl -X POST https://dtctqwoesbvntdpeekgv.supabase.co/functions/v1/twilio-status \
  -H "Content-Type: application/json" \
  -d '{"action": "check_config"}'
```

### 3. Verify Frontend
1. Open app in browser
2. Navigate to System Health page
3. Click "Run Health Checks" button
4. Verify each provider shows status (healthy/not_configured/down)

## Call Flow Verification

```
1. UI Request
   └─► POST /functions/v1/calls-start
       └─► Twilio API: Create Call
           └─► Twilio calls back: POST /functions/v1/twilio-voice
               └─► Returns TwiML with <Stream> to OpenAI
                   └─► Twilio streams audio bidirectionally
           └─► Twilio status: POST /functions/v1/twilio-status
               └─► Idempotency check
               └─► Update call status in DB
```

## Troubleshooting

### Provider Not Configured
**Symptom**: Status shows "NOT_CONFIGURED"
**Fix**: Add required secrets in Lovable Cloud → Settings → Secrets

### Circuit Breaker Open
**Symptom**: Calls fail immediately without trying provider
**Fix**: 
1. Check `provider_status` table for `circuit = 'open'`
2. Wait for cooldown_until to pass
3. Or manually reset: `UPDATE provider_status SET circuit = 'closed', failure_count = 0 WHERE provider = 'xxx'`

### Duplicate Webhooks
**Symptom**: Same event processed multiple times
**Fix**: Check `idempotency_keys` table - duplicates should be blocked

### Call Not Completing
1. Check edge function logs in Lovable Cloud
2. Check `incident_log` table for errors
3. Verify Twilio webhook URLs are correct

## Feature Flags

| Flag | Default | Description |
|------|---------|-------------|
| `calls.outbound.enabled` | true | Enable/disable outbound calls |
| `sms.enabled` | true | Enable/disable SMS sending |
| `ai.enabled` | true | Enable/disable AI features |
| `ai.provider.preferred` | gemini | Preferred AI provider |
| `ai.openai.enabled` | true | Enable OpenAI as fallback |
| `ai.gemini.enabled` | true | Enable Gemini via Lovable AI |
| `healthchecks.enabled` | true | Enable health check runs |

## Monitoring

### Key Tables to Watch
- `provider_status` - Current health of each integration
- `incident_log` - All failures and warnings
- `idempotency_keys` - Webhook processing (expires after 24h)
- `feature_flags` - System configuration

### Alert Conditions
- `provider_status.circuit = 'open'` - Integration is failing
- `incident_log.severity = 'critical'` - Immediate attention needed
- `provider_status.failure_count > 10` - Repeated failures
