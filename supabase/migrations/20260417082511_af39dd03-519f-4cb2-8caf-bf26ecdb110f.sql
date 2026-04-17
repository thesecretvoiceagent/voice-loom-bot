-- CRM vehicles table for inbound bot lookup
CREATE TABLE public.crm_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reg_no TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  body_type TEXT,
  year_of_built INTEGER,
  color TEXT,
  engine_type TEXT,
  gearbox TEXT,
  drivetrain TEXT,
  phone_number TEXT,
  owner_name TEXT,
  insurer TEXT,
  cover_type TEXT,
  cover_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_vehicles_phone ON public.crm_vehicles(phone_number);
CREATE INDEX idx_crm_vehicles_reg_no ON public.crm_vehicles(reg_no);

ALTER TABLE public.crm_vehicles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view; admins can manage
CREATE POLICY "Authenticated can view crm vehicles"
  ON public.crm_vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage crm vehicles"
  ON public.crm_vehicles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role / anon (orchestrator edge functions) can read for lookups
CREATE POLICY "Anon can view crm vehicles"
  ON public.crm_vehicles FOR SELECT
  TO anon
  USING (true);

CREATE TRIGGER update_crm_vehicles_updated_at
  BEFORE UPDATE ON public.crm_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();