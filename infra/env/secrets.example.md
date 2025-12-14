# Infrastructure Environment Variables

## Backend (Edge Functions) - Secrets

These secrets are configured in Lovable Cloud → Settings → Secrets.

### Required for Twilio Integration
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1234567890
```

### Required for OpenAI Realtime Voice
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Required for Public Webhooks
```
PUBLIC_BASE_URL=https://dtctqwoesbvntdpeekgv.supabase.co
PUBLIC_WS_BASE_URL=wss://dtctqwoesbvntdpeekgv.supabase.co
```

### Auto-Configured (DO NOT SET MANUALLY)
```
SUPABASE_URL=<auto-configured>
SUPABASE_SERVICE_ROLE_KEY=<auto-configured>
SUPABASE_ANON_KEY=<auto-configured>
LOVABLE_API_KEY=<auto-configured>
```

## Frontend (.env) - Public Only

These are set in the .env file (auto-managed by Lovable):

```
VITE_SUPABASE_URL=https://dtctqwoesbvntdpeekgv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<auto-configured>
VITE_SUPABASE_PROJECT_ID=dtctqwoesbvntdpeekgv
```

## Configuration Notes

1. **Never commit real secrets** - All secrets are stored in Lovable Cloud Secrets
2. **Edge functions have access to all secrets** - Use `Deno.env.get('SECRET_NAME')`
3. **Frontend only has VITE_ prefixed vars** - Public keys only
4. **Twilio webhooks use PUBLIC_BASE_URL** - Must be reachable from internet
