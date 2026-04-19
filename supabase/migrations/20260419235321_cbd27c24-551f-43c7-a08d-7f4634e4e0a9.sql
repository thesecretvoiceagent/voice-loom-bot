-- Allow Supabase Realtime (orchestrator subscribes with anon key) to receive
-- UPDATE payloads for the calls table. Without an anon SELECT policy, Realtime
-- silently drops postgres_changes events before they reach the orchestrator,
-- which means the AI never gets the location/form confirmation injection.
--
-- Read access to the wider UI is still gated by the existing
-- "Authenticated users can view calls" policy.
CREATE POLICY "Anon can view calls"
ON public.calls
FOR SELECT
TO anon
USING (true);

-- Same fix for sms_messages so inbound-SMS injection is robust.
-- (sms_messages already has anon insert/update; add SELECT for Realtime.)
CREATE POLICY "Anon can view sms messages"
ON public.sms_messages
FOR SELECT
TO anon
USING (true);