
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'outbound' CHECK (type IN ('inbound', 'outbound')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  greeting TEXT DEFAULT '',
  system_prompt TEXT DEFAULT '',
  analysis_prompt TEXT DEFAULT '',
  voice TEXT DEFAULT 'alloy',
  phone_number TEXT DEFAULT '',
  tools TEXT[] DEFAULT '{}',
  settings JSONB DEFAULT '{
    "max_ring_time": 60,
    "max_call_duration": 5,
    "max_retries": 3,
    "concurrent_calls": 3,
    "retry_delay_hours": 0,
    "retry_delay_minutes": 5,
    "enable_recording": true
  }'::jsonb,
  schedule JSONB DEFAULT '{
    "start_time": "09:00",
    "end_time": "17:00",
    "days": ["mon","tue","wed","thu","fri"],
    "timezone": "Europe/Tallinn"
  }'::jsonb,
  knowledge_base JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_user_id ON public.agents(user_id);
CREATE INDEX idx_agents_type ON public.agents(type);
CREATE INDEX idx_agents_is_active ON public.agents(is_active);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all agents"
ON public.agents FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create agents"
ON public.agents FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own agents"
ON public.agents FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own agents"
ON public.agents FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
