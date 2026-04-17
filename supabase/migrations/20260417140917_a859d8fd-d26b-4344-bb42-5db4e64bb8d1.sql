ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS location_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lon double precision,
  ADD COLUMN IF NOT EXISTS location_address text,
  ADD COLUMN IF NOT EXISTS location_confirmed_at timestamptz;

-- Make sure realtime can deliver the new fields
ALTER TABLE public.calls REPLICA IDENTITY FULL;