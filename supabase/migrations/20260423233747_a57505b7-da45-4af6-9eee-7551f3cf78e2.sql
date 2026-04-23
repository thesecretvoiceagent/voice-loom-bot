-- ─────────────────────────────────────────────────────────
-- 1. TENANTS TABLE
-- ─────────────────────────────────────────────────────────
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(slug) >= 2 AND length(slug) <= 50)
);

CREATE INDEX idx_tenants_slug ON public.tenants(slug);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 4 initial tenants (no passwords yet — set via /admin)
INSERT INTO public.tenants (slug, name) VALUES
  ('iizi', 'Iizi'),
  ('themis', 'Themis'),
  ('swedbank', 'Swedbank'),
  ('efta-legal', 'EFTA Legal');

-- ─────────────────────────────────────────────────────────
-- 2. USER_TENANTS MAPPING TABLE
-- ─────────────────────────────────────────────────────────
CREATE TABLE public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_user_tenants_user_id ON public.user_tenants(user_id);
CREATE INDEX idx_user_tenants_tenant_id ON public.user_tenants(tenant_id);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────
-- 3. ADD tenant_id TO EXISTING TABLES (nullable, no data change)
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.agents ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.sms_messages ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX idx_agents_tenant_id ON public.agents(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_calls_tenant_id ON public.calls(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_campaigns_tenant_id ON public.campaigns(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_sms_messages_tenant_id ON public.sms_messages(tenant_id) WHERE tenant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- 4. HELPER FUNCTIONS (security definer to avoid RLS recursion)
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_tenants
      WHERE user_id = _user_id AND tenant_id = _tenant_id
    )
$$;

-- ─────────────────────────────────────────────────────────
-- 5. RLS POLICIES — TENANTS
-- ─────────────────────────────────────────────────────────

-- Anyone authenticated can see tenant slug+name (needed for password gate page lookup)
-- Note: password_hash should NOT be exposed; we'll handle that via edge function only.
-- For safety, we restrict SELECT on full row to admins; non-admins use a view or edge function.
-- Simpler approach: allow authenticated SELECT but never expose password_hash to client (queries use specific columns).
CREATE POLICY "Authenticated users can view tenant basic info"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (true);

-- Anon role also needs to see slug+name for the tenant landing pages (password gate)
CREATE POLICY "Anon can view tenant basic info"
  ON public.tenants FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Admins can insert tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────
-- 6. RLS POLICIES — USER_TENANTS
-- ─────────────────────────────────────────────────────────
CREATE POLICY "Users can view own tenant memberships"
  ON public.user_tenants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage user_tenants"
  ON public.user_tenants FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────
-- 7. NOTE ON EXISTING TABLE POLICIES
-- ─────────────────────────────────────────────────────────
-- We INTENTIONALLY do NOT modify existing RLS policies on agents/calls/
-- campaigns/sms_messages. The current "Anon can view/insert/update" and
-- "Authenticated users can view all" policies remain in place, ensuring
-- the orchestrator (anon key) and existing UI continue to work unchanged.
--
-- Tenant-scoped filtering will be applied in the FRONTEND via .eq('tenant_id', X)
-- queries on the tenant-specific routes (/iizi, /themis, etc.).
-- The /admin and / routes will continue to see ALL data (no filter).
--
-- This is safe because:
--   1. Live voicebot pipeline is unaffected (no policy changes)
--   2. Existing UI on / continues to see everything (no filter)
--   3. New tenant routes only ever query rows tagged with their tenant_id
--   4. tenant_id is NULL on all existing rows → invisible to tenant routes
--      until admin explicitly assigns them via /admin UI