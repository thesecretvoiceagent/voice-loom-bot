
-- Allow service to insert call events via edge function
CREATE POLICY "Service can insert call events"
ON public.call_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow anon role to insert via edge functions
CREATE POLICY "Anon can insert call events"
ON public.call_events
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon role to insert/update calls via edge functions
CREATE POLICY "Anon can insert calls"
ON public.calls
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update calls"
ON public.calls
FOR UPDATE
TO anon
USING (true);
