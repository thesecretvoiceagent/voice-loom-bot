import { Bot, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const agents = [
  { id: 1, name: "Sales Assistant", status: "active", calls: 45, avgDuration: "2:34" },
  { id: 2, name: "Support Agent", status: "active", calls: 32, avgDuration: "4:12" },
  { id: 3, name: "Reminder Bot", status: "idle", calls: 28, avgDuration: "1:05" },
  { id: 4, name: "Collection Agent", status: "active", calls: 18, avgDuration: "3:45" },
];

export function AgentStatus() {
  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">Voice Agents</h3>
      </div>
      <div className="divide-y divide-border">
        {agents.map((agent) => (
          <div
            key={agent.id}
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
        ))}
      </div>
    </div>
  );
}
