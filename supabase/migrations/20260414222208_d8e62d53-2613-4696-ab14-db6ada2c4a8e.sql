-- Allow authenticated users to delete call records
CREATE POLICY "Authenticated users can delete calls"
ON public.calls
FOR DELETE
TO authenticated
USING (true);

-- Allow service role to insert and update calls (for orchestrator)
CREATE POLICY "Service can insert calls"
ON public.calls
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service can update calls"
ON public.calls
FOR UPDATE
TO authenticated
USING (true);