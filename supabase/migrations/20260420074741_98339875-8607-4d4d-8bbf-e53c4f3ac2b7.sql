-- Agents: full anon access
CREATE POLICY "Anon can view agents" ON public.agents FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert agents" ON public.agents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update agents" ON public.agents FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete agents" ON public.agents FOR DELETE TO anon USING (true);

-- Campaigns: full anon access
CREATE POLICY "Anon can view campaigns" ON public.campaigns FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert campaigns" ON public.campaigns FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update campaigns" ON public.campaigns FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete campaigns" ON public.campaigns FOR DELETE TO anon USING (true);

-- Agent flows: full anon access
CREATE POLICY "Anon can view agent flows" ON public.agent_flows FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert agent flows" ON public.agent_flows FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update agent flows" ON public.agent_flows FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can delete agent flows" ON public.agent_flows FOR DELETE TO anon USING (true);

-- SMS messages: anon delete (other ops already exist)
CREATE POLICY "Anon can delete sms messages" ON public.sms_messages FOR DELETE TO anon USING (true);

-- Organization settings: full anon access (orchestrator URL, etc.)
CREATE POLICY "Anon can view organization settings" ON public.organization_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert organization settings" ON public.organization_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update organization settings" ON public.organization_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Calls: anon already has SELECT/INSERT/UPDATE — add DELETE for parity
CREATE POLICY "Anon can delete calls" ON public.calls FOR DELETE TO anon USING (true);

-- Provider status: read-only for anon (status display)
CREATE POLICY "Anon can view provider status" ON public.provider_status FOR SELECT TO anon USING (true);

-- Audit logs: read-only for anon
CREATE POLICY "Anon can view audit logs" ON public.audit_logs FOR SELECT TO anon USING (true);

-- Feature flags: read-only for anon
CREATE POLICY "Anon can view feature flags" ON public.feature_flags FOR SELECT TO anon USING (true);

-- Incident log: read-only for anon
CREATE POLICY "Anon can view incidents" ON public.incident_log FOR SELECT TO anon USING (true);