import { useTenant } from "@/contexts/TenantContext";
import { useAgents } from "@/hooks/useAgents";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

export default function TenantAgents() {
  const { tenant } = useTenant();
  const { agents, loading } = useAgents({ tenant_id: tenant?.id });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Agents</h1>
        <p className="mt-1 text-muted-foreground">
          Voice agents for {tenant?.name}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : agents.length === 0 ? (
        <Card className="p-8 text-center">
          <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No agents assigned to this workspace yet. Admin can assign agents
            in /admin.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Card key={a.id} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{a.name}</h3>
                <Badge variant={a.is_active ? "default" : "secondary"}>
                  {a.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground capitalize">
                {a.type} • {a.voice}
              </p>
              {a.phone_number && (
                <p className="text-xs font-mono text-muted-foreground">
                  {a.phone_number}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
