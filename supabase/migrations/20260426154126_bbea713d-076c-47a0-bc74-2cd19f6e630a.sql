UPDATE public.calls c
SET tenant_id = a.tenant_id
FROM public.agents a
WHERE c.tenant_id IS NULL
  AND c.agent_id IS NOT NULL
  AND a.id::text = c.agent_id
  AND a.tenant_id IS NOT NULL;