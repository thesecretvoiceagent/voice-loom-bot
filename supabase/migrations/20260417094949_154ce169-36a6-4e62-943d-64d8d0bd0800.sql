DROP POLICY IF EXISTS "Users can update own agents" ON public.agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON public.agents;

CREATE POLICY "Authenticated users can update agents"
  ON public.agents FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete agents"
  ON public.agents FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);