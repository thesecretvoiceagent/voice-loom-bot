import React, { useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { isAccessGranted } from "@/components/auth/PasswordGate";

export const TenantGate: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { tenant, loading, authenticated, authenticate } = useTenant();
  // If the global BeyondCode access password has already been granted,
  // skip the per-tenant password — admins/operators are inside the trusted area.
  const globalGranted = isAccessGranted();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-2">
          <h1 className="text-2xl font-bold">Tenant not found</h1>
          <p className="text-muted-foreground">
            This workspace does not exist.
          </p>
        </Card>
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    const result = await authenticate(password);
    setSubmitting(false);
    if (!result.ok) {
      if (result.error === "no_password_set") {
        toast.error("No password set for this workspace yet. Contact admin.");
      } else {
        toast.error("Invalid password");
      }
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-beyondcode flex items-center justify-center shadow-neon">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">
            Enter the workspace password
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-password">Password</Label>
            <Input
              id="tenant-password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
};
