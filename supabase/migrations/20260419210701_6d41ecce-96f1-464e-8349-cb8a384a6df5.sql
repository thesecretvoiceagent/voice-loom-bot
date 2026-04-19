-- Add Google Form fallback fields to calls table
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS form_registration_number text,
  ADD COLUMN IF NOT EXISTS form_callback_phone_number text,
  ADD COLUMN IF NOT EXISTS form_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS form_submission_source text,
  ADD COLUMN IF NOT EXISTS form_raw jsonb;

-- Ensure realtime publication includes calls (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END $$;

-- Ensure full row data is sent on updates (needed for orchestrator subscription)
ALTER TABLE public.calls REPLICA IDENTITY FULL;