-- Per-agent editable IIZI brain policy (intent rules, gates, templates). Orchestrator reads via service role.

CREATE TABLE IF NOT EXISTS public.agent_brain_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents (id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  enabled boolean NOT NULL DEFAULT true,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_brain_configs_agent_lookup
  ON public.agent_brain_configs (agent_id, enabled, version DESC);

COMMENT ON TABLE public.agent_brain_configs IS 'Versioned JSON brain config per agent (IIZI intent/gates); consumed by orchestrator.';

ALTER TABLE public.agent_brain_configs ENABLE ROW LEVEL SECURITY;

-- Match existing permissive anon pattern in this project; orchestrator should prefer SUPABASE_SERVICE_ROLE_KEY.
CREATE POLICY "Anon can select enabled agent brain configs"
  ON public.agent_brain_configs FOR SELECT TO anon
  USING (enabled = true);

CREATE POLICY "Anon can insert agent brain configs"
  ON public.agent_brain_configs FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update agent brain configs"
  ON public.agent_brain_configs FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete agent brain configs"
  ON public.agent_brain_configs FOR DELETE TO anon
  USING (true);

DROP TRIGGER IF EXISTS agent_brain_configs_set_updated ON public.agent_brain_configs;

CREATE TRIGGER agent_brain_configs_set_updated
  BEFORE UPDATE ON public.agent_brain_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
