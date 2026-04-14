ALTER TABLE public.organization_settings 
ADD COLUMN IF NOT EXISTS orchestrator_url text DEFAULT '';