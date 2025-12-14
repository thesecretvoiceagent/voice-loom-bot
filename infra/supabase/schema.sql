-- Infrastructure Schema for Voice Platform
-- Run this via Supabase migrations (already applied via Lovable)

-- Provider status tracking (circuit breaker state)
CREATE TABLE IF NOT EXISTS provider_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- supabase, twilio, openai, gemini, vercel_runtime, railway_workers
  component TEXT NOT NULL DEFAULT 'api', -- api, voice, tts, stt, webhook, worker
  state TEXT NOT NULL DEFAULT 'healthy', -- healthy, degraded, down
  circuit TEXT NOT NULL DEFAULT 'closed', -- closed, open, half_open
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, component)
);

-- Feature flags / kill switches
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  value TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  scope TEXT NOT NULL DEFAULT 'global', -- global, env, tenant
  notes TEXT,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency keys for webhook/job safety
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  payload_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Incident log for failures
CREATE TABLE IF NOT EXISTS incident_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'info', -- info, warn, critical
  source TEXT NOT NULL, -- provider/component
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls table (for future use)
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_number TEXT NOT NULL,
  from_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  direction TEXT NOT NULL DEFAULT 'outbound',
  twilio_call_sid TEXT,
  agent_id UUID,
  campaign_id UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcription TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call events table (for future use)
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Health checks table (for future use)
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  component TEXT NOT NULL,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  last_ok_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_incident_log_severity ON incident_log(severity);
CREATE INDEX IF NOT EXISTS idx_incident_log_created ON incident_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires ON idempotency_keys(expires_at);

-- Default feature flags
INSERT INTO feature_flags (key, enabled, notes) VALUES
  ('calls.outbound.enabled', true, 'Enable outbound call placement'),
  ('sms.enabled', true, 'Enable SMS sending'),
  ('ai.enabled', true, 'Enable AI features'),
  ('ai.provider.preferred', true, 'Preferred AI provider (value: openai or gemini)'),
  ('ai.openai.enabled', true, 'Enable OpenAI as AI provider'),
  ('ai.gemini.enabled', true, 'Enable Gemini as AI provider'),
  ('ai.gemini.voice.enabled', true, 'Enable Gemini voice features'),
  ('healthchecks.enabled', true, 'Enable health check runs')
ON CONFLICT (key) DO NOTHING;
