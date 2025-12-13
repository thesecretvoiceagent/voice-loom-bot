import { PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const recentCalls = [
  {
    id: 1,
    phone: "+372 5123 4567",
    type: "inbound",
    agent: "Sales Assistant",
    duration: "3:42",
    status: "completed",
    time: "2 min ago",
  },
  {
    id: 2,
    phone: "+372 5234 5678",
    type: "outbound",
    agent: "Reminder Bot",
    duration: "1:15",
    status: "completed",
    time: "5 min ago",
  },
  {
    id: 3,
    phone: "+372 5345 6789",
    type: "inbound",
    agent: "Support Agent",
    duration: "0:00",
    status: "missed",
    time: "12 min ago",
  },
  {
    id: 4,
    phone: "+372 5456 7890",
    type: "outbound",
    agent: "Collection Agent",
    duration: "2:30",
    status: "completed",
    time: "18 min ago",
  },
  {
    id: 5,
    phone: "+372 5567 8901",
    type: "inbound",
    agent: "Sales Assistant",
    duration: "5:12",
    status: "in_progress",
    time: "now",
  },
];

export function RecentCalls() {
  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">Recent Calls</h3>
      </div>
      <div className="divide-y divide-border">
        {recentCalls.map((call) => (
          <div
            key={call.id}
            className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/30"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                call.type === "inbound" ? "bg-success/10" : "bg-primary/10"
              )}
            >
              {call.type === "inbound" ? (
                <PhoneIncoming
                  className={cn(
                    "h-5 w-5",
                    call.type === "inbound" ? "text-success" : "text-primary"
                  )}
                />
              ) : (
                <PhoneOutgoing className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground font-mono text-sm">
                {call.phone}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {call.agent}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                {call.status === "completed" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                )}
                {call.status === "missed" && (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                )}
                {call.status === "in_progress" && (
                  <Clock className="h-3.5 w-3.5 text-warning animate-pulse" />
                )}
                <span className="text-sm font-mono text-foreground">
                  {call.duration}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{call.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
