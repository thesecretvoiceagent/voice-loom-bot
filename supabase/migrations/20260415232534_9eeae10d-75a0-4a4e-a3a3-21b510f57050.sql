
-- Create agent_flows table for storing visual flow data per agent
CREATE TABLE public.agent_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Main Flow',
  status TEXT NOT NULL DEFAULT 'draft', -- draft, published
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

-- Enable RLS
ALTER TABLE public.agent_flows ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own flows"
  ON public.agent_flows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own flows"
  ON public.agent_flows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flows"
  ON public.agent_flows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flows"
  ON public.agent_flows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_agent_flows_agent_id ON public.agent_flows(agent_id);
CREATE INDEX idx_agent_flows_user_id ON public.agent_flows(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_agent_flows_updated_at
  BEFORE UPDATE ON public.agent_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
