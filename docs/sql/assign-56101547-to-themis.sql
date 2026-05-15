-- Assign Twilio number +372 56101547 to Themis-only voice routing.
-- Safe to re-run (idempotent). Does NOT change Twilio credentials or secrets.
--
-- What this does:
--   1. Clears +37256101547 from every agent (including IIZI production agent 00def519…).
--   2. Assigns the number to the active inbound agent on tenants.slug = 'themis'.
--   3. Merges settings: themis_mode=true, use_combined_reg_location_sms=false (no IIZI pipeline).
--   4. Syncs public.phone_numbers pool row.
--   5. If IIZI agent 00def519… lost this number, sets +37256101535 (IIZI primary in UI).
--
-- Operator (Twilio Console — NOT applied by this script):
--   Voice webhook for +37256101547 → {PUBLIC_BASE_URL}/twilio/voice  (Railway orchestrator)
--   Status callback → {PUBLIC_BASE_URL}/twilio/status
--   Do NOT point this number at Supabase /functions/v1/twilio-voice
--
-- Verification (run after apply):
--   See bottom SELECT block.

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
    RAISE EXCEPTION 'tenants.slug=themis not found — run tenant seed migration first';
  END IF;

  -- Detach number from all agents (digits-only match).
  UPDATE public.agents
  SET phone_number = NULL,
      updated_at = now()
  WHERE regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') = v_target_digits;

  -- Detach from phone_numbers pool (trigger may have cleared agents already).
  UPDATE public.phone_numbers
  SET agent_id = NULL,
      tenant_id = NULL,
      updated_at = now()
  WHERE regexp_replace(phone_number, '\D', '', 'g') = v_target_digits;

  -- Prefer existing Themis inbound agent.
  SELECT a.id
  INTO v_themis_agent
  FROM public.agents a
  WHERE a.tenant_id = v_themis_tenant
    AND a.is_active = true
    AND a.type = 'inbound'
  ORDER BY
    CASE WHEN a.name ILIKE '%themis%' THEN 0 ELSE 1 END,
    a.updated_at DESC NULLS LAST,
    a.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_themis_agent IS NULL THEN
    SELECT ur.user_id INTO v_admin_user
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;

    IF v_admin_user IS NULL THEN
      SELECT a.user_id INTO v_admin_user FROM public.agents a ORDER BY a.created_at LIMIT 1;
    END IF;

    IF v_admin_user IS NULL THEN
      RAISE EXCEPTION 'No admin user found — create a Themis inbound agent in UI, then re-run this script';
    END IF;

    INSERT INTO public.agents (
      user_id,
      name,
      type,
      is_active,
      greeting,
      system_prompt,
      tenant_id,
      phone_number,
      tools,
      settings
    ) VALUES (
      v_admin_user,
      'Themis Inbound',
      'inbound',
      true,
      'Tere, helistab Themis Õigusbüroo. Kas ma räägin õige isikuga?',
      'Sa oled Themis Õigusbüroo võlanõuete hääleagent. Kasuta alati vormilist "Teie"-vormi. Enne isiku tuvastamist ära avalda võla summat ega üksikasju. Pärast tuvastust selgita võlgnevust ja kogu maksegraafiku tingimused. Kinnita kokkulepe selgelt enne kõne lõpetamist.',
      v_themis_tenant,
      v_target_e164,
      ARRAY['end_call']::text[],
      jsonb_build_object(
        'themis_mode', true,
        'use_combined_reg_location_sms', false
      )
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

  -- Restore IIZI production line to primary IIZI number when it held 56101547.
  UPDATE public.agents
  SET phone_number = v_iizi_e164,
      updated_at = now()
  WHERE id = v_iizi_agent
    AND (
      phone_number IS NULL
      OR regexp_replace(coalesce(phone_number, ''), '\D', '', 'g') = ''
    );

  RAISE NOTICE 'Themis agent % now owns %', v_themis_agent, v_target_e164;
END $assign$;

-- ── Verification ─────────────────────────────────────────────
SELECT
  regexp_replace(a.phone_number, '\D', '', 'g') AS digits,
  a.id,
  a.name,
  a.type,
  a.is_active,
  t.slug AS tenant_slug,
  (a.settings->>'themis_mode') AS themis_mode,
  (a.settings->>'use_combined_reg_location_sms') AS iizi_combined_sms
FROM public.agents a
LEFT JOIN public.tenants t ON t.id = a.tenant_id
WHERE regexp_replace(coalesce(a.phone_number, ''), '\D', '', 'g') IN ('37256101547', '37256101535')
ORDER BY digits;

SELECT
  pn.phone_number,
  pn.label,
  t.slug AS tenant_slug,
  a.name AS agent_name,
  (a.settings->>'themis_mode') AS themis_mode
FROM public.phone_numbers pn
LEFT JOIN public.tenants t ON t.id = pn.tenant_id
LEFT JOIN public.agents a ON a.id = pn.agent_id
WHERE regexp_replace(pn.phone_number, '\D', '', 'g') = '37256101547';
