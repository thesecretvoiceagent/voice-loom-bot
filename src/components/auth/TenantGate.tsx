import React from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

/** Demo mode: no workspace password gate — open tenant routes directly. */
export const TenantGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant, loading } = useTenant();

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
          <p className="text-muted-foreground">This workspace does not exist.</p>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
