-- Create enum types for provider status
CREATE TYPE provider_name AS ENUM (
  'supabase',
  'twilio', 
  'openai',
  'gemini',
  'vercel_runtime',
  'railway_workers'
);

CREATE TYPE provider_state AS ENUM ('healthy', 'degraded', 'down');
CREATE TYPE circuit_state AS ENUM ('closed', 'open', 'half_open');
CREATE TYPE flag_scope AS ENUM ('global', 'env', 'tenant');
CREATE TYPE incident_severity AS ENUM ('info', 'warn', 'critical');

-- Provider status table for circuit breaker state
CREATE TABLE public.provider_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider provider_name NOT NULL,
  component TEXT NOT NULL DEFAULT 'api',
  state provider_state NOT NULL DEFAULT 'healthy',
  circuit circuit_state NOT NULL DEFAULT 'closed',
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, component)
);

-- Feature flags table for kill switches
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  value TEXT,
  scope flag_scope NOT NULL DEFAULT 'global',
  notes TEXT,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency keys for webhook/job safety
CREATE TABLE public.idempotency_keys (
  key TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  payload_hash TEXT
);

-- Incident log for human-readable records
CREATE TABLE public.incident_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity incident_severity NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provider_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_log ENABLE ROW LEVEL SECURITY;

-- Provider status policies (admin/operator can view, admin can modify)
CREATE POLICY "Admins can manage provider status"
  ON public.provider_status FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view provider status"
  ON public.provider_status FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Feature flags policies
CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view feature flags"
  ON public.feature_flags FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Idempotency keys policies (system access via service role)
CREATE POLICY "Service can manage idempotency keys"
  ON public.idempotency_keys FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Incident log policies
CREATE POLICY "Admins can manage incidents"
  ON public.incident_log FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view incidents"
  ON public.incident_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert incidents"
  ON public.incident_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default feature flags
INSERT INTO public.feature_flags (key, enabled, value, notes) VALUES
  ('calls.outbound.enabled', true, NULL, 'Enable/disable outbound calls'),
  ('sms.enabled', true, NULL, 'Enable/disable SMS sending'),
  ('ai.enabled', true, NULL, 'Master switch for all AI features'),
  ('ai.provider.preferred', true, 'gemini', 'Preferred AI provider: openai or gemini'),
  ('ai.openai.enabled', true, NULL, 'Enable OpenAI provider'),
  ('ai.gemini.enabled', true, NULL, 'Enable Gemini provider'),
  ('ai.gemini.voice.enabled', true, NULL, 'Enable Gemini voice features'),
  ('healthchecks.enabled', true, NULL, 'Enable automated health checks');

-- Insert default provider status records
INSERT INTO public.provider_status (provider, component, state, circuit) VALUES
  ('supabase', 'database', 'healthy', 'closed'),
  ('supabase', 'auth', 'healthy', 'closed'),
  ('twilio', 'api', 'healthy', 'closed'),
  ('twilio', 'webhook', 'healthy', 'closed'),
  ('openai', 'api', 'healthy', 'closed'),
  ('gemini', 'api', 'healthy', 'closed'),
  ('gemini', 'voice', 'healthy', 'closed'),
  ('vercel_runtime', 'app', 'healthy', 'closed'),
  ('railway_workers', 'worker', 'healthy', 'closed');

-- Create updated_at trigger for provider_status
CREATE TRIGGER update_provider_status_updated_at
  BEFORE UPDATE ON public.provider_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for feature_flags
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();