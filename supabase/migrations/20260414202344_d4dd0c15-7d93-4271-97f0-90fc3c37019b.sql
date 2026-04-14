
-- Create calls table
CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  twilio_call_sid TEXT,
  agent_id TEXT,
  campaign_id TEXT,
  to_number TEXT NOT NULL,
  from_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  direction TEXT NOT NULL DEFAULT 'outbound',
  duration_seconds INTEGER,
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE,
  answered_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_events table
CREATE TABLE public.call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_calls_status ON public.calls(status);
CREATE INDEX idx_calls_agent_id ON public.calls(agent_id);
CREATE INDEX idx_calls_campaign_id ON public.calls(campaign_id);
CREATE INDEX idx_calls_created_at ON public.calls(created_at DESC);
CREATE INDEX idx_call_events_call_id ON public.call_events(call_id);
CREATE INDEX idx_call_events_type ON public.call_events(type);

-- Enable RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read calls
CREATE POLICY "Authenticated users can view calls"
ON public.calls FOR SELECT TO authenticated
USING (true);

-- Authenticated users can read call events
CREATE POLICY "Authenticated users can view call events"
ON public.call_events FOR SELECT TO authenticated
USING (true);

-- Service role can do everything (orchestrator uses service role key)
-- No explicit policy needed as service role bypasses RLS

-- Enable realtime for calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

-- Auto-update updated_at
CREATE TRIGGER update_calls_updated_at
BEFORE UPDATE ON public.calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
