import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Shield } from "lucide-react";
import { toast } from "sonner";

const ACCESS_PASSWORD = "beyondcodeAIKuh26uTa!";
const STORAGE_KEY = "bc_access_granted_v1";

export function isAccessGranted(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1" || localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface PasswordGateProps {
  children: React.ReactNode;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
  const [granted, setGranted] = useState<boolean>(() => isAccessGranted());
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Re-check on mount in case storage changed
    setGranted(isAccessGranted());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (password === ACCESS_PASSWORD) {
      try {
        if (remember) {
          localStorage.setItem(STORAGE_KEY, "1");
        } else {
          sessionStorage.setItem(STORAGE_KEY, "1");
        }
      } catch {
        /* ignore */
      }
      setGranted(true);
      toast.success("Access granted");
    } else {
      toast.error("Incorrect password");
      setPassword("");
    }
    setSubmitting(false);
  };

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
