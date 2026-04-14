import { Bot, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import type { CallRow } from "@/hooks/useCalls";

interface AgentStatusProps {
  calls: CallRow[];
  loading?: boolean;
}

interface AgentStat {
  name: string;
  status: "active" | "idle";
  calls: number;
  avgDuration: string;
}

export function AgentStatus({ calls, loading }: AgentStatusProps) {
  const agents = useMemo<AgentStat[]>(() => {
    const agentMap = new Map<string, CallRow[]>();

    for (const call of calls) {
      const id = call.agent_id || "unknown";
      if (!agentMap.has(id)) agentMap.set(id, []);
      agentMap.get(id)!.push(call);
    }

    return Array.from(agentMap.entries()).map(([name, agentCalls]) => {
      const completed = agentCalls.filter((c) => c.status === "completed");
      const totalDuration = completed.reduce(
        (sum, c) => sum + (c.duration_seconds || 0),
        0
      );
      const avg = completed.length > 0 ? totalDuration / completed.length : 0;
      const m = Math.floor(avg / 60);
      const s = Math.round(avg % 60);

      const hasActive = agentCalls.some((c) =>
        ["initiated", "ringing", "in-progress"].includes(c.status)
      );

      return {
        name,
        status: hasActive ? "active" as const : "idle" as const,
        calls: agentCalls.length,
        avgDuration: `${m}:${s.toString().padStart(2, "0")}`,
      };
    }).sort((a, b) => b.calls - a.calls);
  }, [calls]);

  if (loading) {
    return (
      <div className="glass-card rounded-xl">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Voice Agents</h3>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">Voice Agents</h3>
      </div>
      <div className="divide-y divide-border">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No agent data yet
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.name}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/30"
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <Circle
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current",
                    agent.status === "active"
                      ? "text-success"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{agent.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {agent.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {agent.calls} calls
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  avg {agent.avgDuration}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
