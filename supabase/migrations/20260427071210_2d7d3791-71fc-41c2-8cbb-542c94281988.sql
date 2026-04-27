UPDATE public.agents
SET
  settings = jsonb_set(
    settings,
    '{sms_messages}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'id' = 'd2ed7f07-c2ef-4868-ae04-b9a021f62287'
               OR elem->>'name' ILIKE '%callback%'
               OR elem->>'name' ILIKE '%tagasihelist%'
          THEN elem
            || jsonb_build_object(
              'name', 'Retrieval of callback number through SMS',
              'description', 'Retrieval of callback number through SMS',
              'content', 'Palun sisestage oma tagasihelistamise number siin lingil: {{form2_link}}',
              'trigger', 'during',
              'order', 2
            )
          WHEN elem->>'name' = 'Registreerimisnumbri SMS'
          THEN elem
            || jsonb_build_object(
              'description', 'Retrieval of registration number through SMS',
              'content', 'Palun sisestage oma numbrimärk: {{form_link}}',
              'trigger', 'during',
              'order', 0
            )
          WHEN elem->>'name' = 'Asukoha SMS'
          THEN elem
            || jsonb_build_object(
              'description', 'AI suggests location link',
              'content', 'Kinnitage oma asukoht: {{location_link}}',
              'trigger', 'during',
              'order', 1
            )
          ELSE elem
        END
        ORDER BY COALESCE((elem->>'order')::int, ordinality::int)
      )
      FROM jsonb_array_elements(settings->'sms_messages') WITH ORDINALITY AS t(elem, ordinality)
    )
  ),
  system_prompt = replace(
    replace(
      replace(
        replace(
          system_prompt,
          '- callback number step -> "Tagasihelistamise numbri SMS"',
          '- callback number step -> "Retrieval of callback number through SMS"'
        ),
        'send "Tagasihelistamise numbri SMS"',
        'send "Retrieval of callback number through SMS"'
      ),
      '{"template_name":"Tagasihelistamise numbri SMS"}',
      '{"template_name":"Retrieval of callback number through SMS"}'
    ),
    'Callback number is SMS-default using "Tagasihelistamise numbri SMS".',
    'Callback number is SMS-default using "Retrieval of callback number through SMS".'
  ) || E'\n\n## LIVE DATA ACCURACY OVERRIDE\n- The assistant must never say it has registration, callback, location, vehicle, or coverage data unless that exact value was provided by the caller, returned by a trusted tool, or returned in a SYSTEM EVENT.\n- If a SYSTEM EVENT contains only form_registration_number, only the registration number is known; callback_phone_number remains missing.\n- If a SYSTEM EVENT contains only form_callback_phone_number, only the callback number is known; registration number remains missing.\n- Blank, null, undefined, placeholder, or 0 values are missing and must not be spoken or treated as collected.\n- Available SMS template names override any older template names in this prompt.',
  updated_at = now()
WHERE id = '00def519-9dd5-402e-bb36-bbb4a865dbc6';