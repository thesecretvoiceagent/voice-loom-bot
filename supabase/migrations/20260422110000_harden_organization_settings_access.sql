-- Milestone 3A.1: harden organization_settings access
-- Keep authenticated self-scope access intact.
-- Remove broad anon access added later.

DROP POLICY IF EXISTS "Anon can view organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Anon can insert organization settings" ON public.organization_settings;
DROP POLICY IF EXISTS "Anon can update organization settings" ON public.organization_settings;
