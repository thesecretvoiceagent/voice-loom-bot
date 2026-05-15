-- Route +372 56101547 to Themis tenant/agent only (see docs/sql/assign-56101547-to-themis.sql).
-- Idempotent; does not modify IIZI prompts, brain, or orchestrator logic.

DO $assign$
DECLARE
  v_target_digits CONSTANT text := '37256101547';
  v_target_e164   CONSTANT text := '+37256101547';
  v_iizi_agent    CONSTANT uuid := '00def519-9dd5-402e-bb36-bbb4a865dbc6';
  v_iizi_e164     CONSTANT text := '+37256101535';
  v_themis_tenant uuid;
  v_themis_agent  uuid;
  v_admin_user    uuid;
BEGIN
  SELECT id INTO v_themis_tenant FROM public.tenants WHERE slug = 'themis' LIMIT 1;
  IF v_themis_tenant IS NULL THEN
    RAISE EXCEPTION 'tenants.slug=themis not found';
  END IF;

  UPDATE public.agents
  SET phone_number = NULL, updated_at = now()
  WHERE regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') = v_target_digits;

  UPDATE public.phone_numbers
  SET agent_id = NULL, tenant_id = NULL, updated_at = now()
  WHERE regexp_replace(phone_number, '\D', '', 'g') = v_target_digits;

  SELECT a.id INTO v_themis_agent
  FROM public.agents a
  WHERE a.tenant_id = v_themis_tenant AND a.is_active = true AND a.type = 'inbound'
  ORDER BY
    CASE WHEN a.name ILIKE '%themis%' THEN 0 ELSE 1 END,
    a.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_themis_agent IS NULL THEN
    SELECT ur.user_id INTO v_admin_user
    FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1;
    IF v_admin_user IS NULL THEN
      SELECT a.user_id INTO v_admin_user FROM public.agents a ORDER BY a.created_at LIMIT 1;
    END IF;
    IF v_admin_user IS NULL THEN
      RAISE EXCEPTION 'No admin user — create Themis inbound agent in UI first';
    END IF;

    INSERT INTO public.agents (
      user_id, name, type, is_active, greeting, system_prompt,
      tenant_id, phone_number, tools, settings
    ) VALUES (
      v_admin_user,
      'Themis Inbound',
      'inbound',
      true,
      'Tere, helistab Themis Õigusbüroo. Kas ma räägin õige isikuga?',
      'Sa oled Themis Õigusbüroo võlanõuete hääleagent. Kasuta alati vormilist "Teie"-vormi. Enne isiku tuvastamist ära avalda võla summat ega üksikasju.',
      v_themis_tenant,
      v_target_e164,
      ARRAY['end_call']::text[],
      jsonb_build_object('themis_mode', true, 'use_combined_reg_location_sms', false)
    )
    RETURNING id INTO v_themis_agent;
  ELSE
    UPDATE public.agents
    SET
      phone_number = v_target_e164,
      tenant_id = v_themis_tenant,
      settings = coalesce(settings, '{}'::jsonb)
        || jsonb_build_object('themis_mode', true)
        || jsonb_build_object('use_combined_reg_location_sms', false),
      updated_at = now()
    WHERE id = v_themis_agent;
  END IF;

  INSERT INTO public.phone_numbers (phone_number, label, tenant_id, agent_id, is_active)
  VALUES (v_target_e164, 'Themis inbound (+372 56101547)', v_themis_tenant, v_themis_agent, true)
  ON CONFLICT (phone_number) DO UPDATE SET
    label = EXCLUDED.label,
    tenant_id = EXCLUDED.tenant_id,
    agent_id = EXCLUDED.agent_id,
    is_active = true,
    updated_at = now();

  UPDATE public.agents
  SET phone_number = v_iizi_e164, updated_at = now()
  WHERE id = v_iizi_agent
    AND (phone_number IS NULL OR regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') = '');
END $assign$;
