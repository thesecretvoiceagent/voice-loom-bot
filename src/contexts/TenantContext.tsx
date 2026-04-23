import React, { createContext, useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

interface TenantContextValue {
  tenant: Tenant | null;
  loading: boolean;
  authenticated: boolean;
  authenticate: (password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const sessionKey = (slug: string) => `tenant_session_${slug}`;

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTenant(null);
    setAuthenticated(false);

    if (!tenantSlug) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, slug, name")
        .eq("slug", tenantSlug.toLowerCase())
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setTenant(null);
        setLoading(false);
        return;
      }

      setTenant(data);
      // Check existing session
      const stored = sessionStorage.getItem(sessionKey(data.slug));
      if (stored === data.id) {
        setAuthenticated(true);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  const authenticate = async (password: string) => {
    if (!tenant) return { ok: false, error: "no_tenant" };
    const { data, error } = await supabase.functions.invoke("tenant-auth", {
      body: { action: "verify", slug: tenant.slug, password },
    });
    if (error || !data?.ok) {
      return { ok: false, error: data?.error || error?.message || "failed" };
    }
    sessionStorage.setItem(sessionKey(tenant.slug), tenant.id);
    setAuthenticated(true);
    return { ok: true };
  };

  const signOut = () => {
    if (tenant) sessionStorage.removeItem(sessionKey(tenant.slug));
    setAuthenticated(false);
  };

  return (
    <TenantContext.Provider
      value={{ tenant, loading, authenticated, authenticate, signOut }}
    >
      {children}
    </TenantContext.Provider>
  );
};
