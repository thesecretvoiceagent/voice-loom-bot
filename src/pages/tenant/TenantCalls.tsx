import { useTenant } from "@/contexts/TenantContext";
import { useCalls } from "@/hooks/useCalls";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TenantCalls() {
  const { tenant } = useTenant();
  const { calls, loading } = useCalls({ tenant_id: tenant?.id, limit: 200 });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Call Logs</h1>
        <p className="mt-1 text-muted-foreground">
          Calls for {tenant?.name}
        </p>
      </div>

      <Card className="p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">No calls yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.to_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()} • {c.direction}
                  </div>
                </div>
                <Badge variant="outline">{c.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
