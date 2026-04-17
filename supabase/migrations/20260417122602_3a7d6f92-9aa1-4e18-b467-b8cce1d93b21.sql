-- Create sms_messages table
CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  agent_id TEXT,
  template_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  twilio_sid TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_messages_call_id ON public.sms_messages(call_id);
CREATE INDEX idx_sms_messages_from_number ON public.sms_messages(from_number);
CREATE INDEX idx_sms_messages_created_at ON public.sms_messages(created_at DESC);

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sms messages"
  ON public.sms_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert sms messages"
  ON public.sms_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anon can insert sms messages"
  ON public.sms_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service can update sms messages"
  ON public.sms_messages FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Anon can update sms messages"
  ON public.sms_messages FOR UPDATE
  TO anon
  USING (true);

CREATE TRIGGER update_sms_messages_updated_at
  BEFORE UPDATE ON public.sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.sms_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;