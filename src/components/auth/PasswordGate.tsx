import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

// The access password is validated SERVER-SIDE (see server.js /api/app-auth/*).
// It is never present in this bundle. On success the server sets a signed,
// HTTP-only session cookie, so we only ever ask the server whether the current
// visitor is authenticated.
//
// In local Vite dev (`npm run dev`) there is no Node server backing these
// endpoints, so we explicitly bypass the gate. This bypass only exists in dev
// builds — production builds always enforce the server check.
const DEV_BYPASS = import.meta.env.DEV;
const AUTH_STATUS_TIMEOUT_MS = 8000;

async function fetchAuthStatus(): Promise<{ authenticated: boolean; configured?: boolean } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_STATUS_TIMEOUT_MS);
  try {
    const res = await fetch("/api/app-auth/status", {
      credentials: "include",
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function logoutAppAccess(): Promise<void> {
  try {
    await fetch("/api/app-auth/logout", { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
}

// Exposed so a logout control elsewhere (e.g. the sidebar) can clear the gate.
export { logoutAppAccess };

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [granted, setGranted] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverUnavailable, setServerUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    if (DEV_BYPASS) {
      console.warn("[PasswordGate] Dev build — access gate bypassed locally.");
      setGranted(true);
      setChecking(false);
      return;
    }

    (async () => {
      const data = await fetchAuthStatus();
      if (!active) return;
      if (data == null) {
        setServerUnavailable(true);
        setGranted(false);
      } else {
        setServerUnavailable(false);
        setGranted(Boolean(data.authenticated));
      }
      setChecking(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/app-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, remember }),
      });

      if (res.ok) {
        setGranted(true);
        toast.success("Access granted");
        return;
      }

      let error = "";
      try {
        error = (await res.json())?.error ?? "";
      } catch {
        /* ignore */
      }

      if (res.status === 503 || error === "auth_not_configured") {
        toast.error("Access is not configured yet. Contact your administrator.");
      } else if (res.status === 429 || error === "too_many_attempts") {
        toast.error("Too many attempts. Please wait a few minutes and try again.");
      } else {
        toast.error("Incorrect password");
        setPassword("");
      }
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (granted) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">BeyondCode AI</h1>
          <p className="text-muted-foreground mt-2">Enter access password to continue</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Access</CardTitle>
            <CardDescription className="text-center">Password protected area</CardDescription>
          </CardHeader>
          <CardContent>
            {serverUnavailable && (
              <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Auth server not reachable. Railway start command must be{" "}
                <code className="font-mono text-xs">node server.js</code> (not{" "}
                <code className="font-mono text-xs">npx serve</code>). Redeploy
                after setting <code className="font-mono text-xs">APP_ACCESS_PASSWORD</code>.
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="access-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-border"
                />
                Remember on this device
              </label>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Checking..." : "Enter Dashboard"}
              </Button>
            </form>
            <div className="mt-6 pt-4 border-t border-border/50">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>BeyondCode AI • Internal Access</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
