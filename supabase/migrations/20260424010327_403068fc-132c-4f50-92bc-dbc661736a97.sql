
-- Phone numbers pool managed by admin
CREATE TABLE public.phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  label TEXT,
  provider TEXT DEFAULT 'twilio',
  country TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage phone numbers"
ON public.phone_numbers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read (so workspace UI can display assigned number)
CREATE POLICY "Authenticated can read phone numbers"
ON public.phone_numbers
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_phone_numbers_agent ON public.phone_numbers(agent_id);
CREATE INDEX idx_phone_numbers_tenant ON public.phone_numbers(tenant_id);

-- Trigger: keep agents.phone_number in sync when assignment changes
CREATE OR REPLACE FUNCTION public.sync_agent_phone_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a number is being assigned to an agent, update that agent
  IF NEW.agent_id IS NOT NULL THEN
    UPDATE public.agents
    SET phone_number = NEW.phone_number, updated_at = now()
    WHERE id = NEW.agent_id;
  END IF;

  -- If we changed assignment away from an agent, clear that agent's number
  IF TG_OP = 'UPDATE'
     AND OLD.agent_id IS NOT NULL
     AND (NEW.agent_id IS NULL OR NEW.agent_id <> OLD.agent_id) THEN
    UPDATE public.agents
    SET phone_number = NULL, updated_at = now()
    WHERE id = OLD.agent_id
      AND phone_number = OLD.phone_number;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_agent_phone_number
AFTER INSERT OR UPDATE OF agent_id, phone_number ON public.phone_numbers
FOR EACH ROW EXECUTE FUNCTION public.sync_agent_phone_number();

-- Updated_at trigger
CREATE TRIGGER trg_phone_numbers_updated_at
BEFORE UPDATE ON public.phone_numbers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
