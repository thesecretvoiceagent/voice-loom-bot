-- Allow anon role to manage CRM vehicles (insert/update/delete)
CREATE POLICY "Anon can insert crm vehicles"
ON public.crm_vehicles
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon can update crm vehicles"
ON public.crm_vehicles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can delete crm vehicles"
ON public.crm_vehicles
FOR DELETE
TO anon
USING (true);