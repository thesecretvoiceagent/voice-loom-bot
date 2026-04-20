-- Allow any authenticated user to insert/update/delete CRM vehicle rows
-- This powers the dynamic "Knowledge Base" management UI inside agents
CREATE POLICY "Authenticated can insert crm vehicles"
ON public.crm_vehicles
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update crm vehicles"
ON public.crm_vehicles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete crm vehicles"
ON public.crm_vehicles
FOR DELETE
TO authenticated
USING (true);