import { useMemo } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useCalls } from "@/hooks/useCalls";
import { useAgents } from "@/hooks/useAgents";
import { Card } from "@/components/ui/card";
import { Phone, PhoneIncoming, PhoneOutgoing, Bot } from "lucide-react";

export default function TenantDashboard() {
  const { tenant } = useTenant();
  const { calls } = useCalls({ tenant_id: tenant?.id, limit: 500 });
  const { agents } = useAgents({ tenant_id: tenant?.id });

  const stats = useMemo(() => {
    const inbound = calls.filter((c) => c.direction === "inbound").length;
    const outbound = calls.filter((c) => c.direction === "outbound").length;
    return { total: calls.length, inbound, outbound, agents: agents.length };
  }, [calls, agents]);

  if (!tenant) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">{tenant.name}</h1>
        <p className="mt-1 text-muted-foreground">Workspace overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatTile icon={<Phone className="h-5 w-5" />} label="Total calls" value={stats.total} />
        <StatTile icon={<PhoneIncoming className="h-5 w-5" />} label="Inbound" value={stats.inbound} />
        <StatTile icon={<PhoneOutgoing className="h-5 w-5" />} label="Outbound" value={stats.outbound} />
        <StatTile icon={<Bot className="h-5 w-5" />} label="Agents" value={stats.agents} />
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent calls</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No calls yet for this workspace. Once an admin assigns agents to{" "}
            <strong>{tenant.name}</strong>, calls will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {calls.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between border-b border-border pb-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {c.direction === "inbound" ? (
                    <PhoneIncoming className="h-4 w-4 text-primary" />
                  ) : (
                    <PhoneOutgoing className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-sm">{c.to_number}</span>
                </div>
                <span className="text-xs text-muted-foreground">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </Card>
  );
}
