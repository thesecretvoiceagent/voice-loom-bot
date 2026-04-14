import { PhoneIncoming, PhoneOutgoing, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallRow } from "@/hooks/useCalls";
import { formatDistanceToNow } from "date-fns";

interface RecentCallsProps {
  calls: CallRow[];
  loading?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTimeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

export function RecentCalls({ calls, loading }: RecentCallsProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-xl">
        <div className="border-b border-border p-4">
          <h3 className="font-semibold text-foreground">Recent Calls</h3>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold text-foreground">Recent Calls</h3>
      </div>
      <div className="divide-y divide-border">
        {calls.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No calls yet
          </div>
        ) : (
          calls.map((call) => (
            <div
              key={call.id}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/30"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  call.direction === "inbound" ? "bg-success/10" : "bg-primary/10"
                )}
              >
                {call.direction === "inbound" ? (
                  <PhoneIncoming className="h-5 w-5 text-success" />
                ) : (
                  <PhoneOutgoing className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground font-mono text-sm">
                  {call.to_number}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {call.agent_id || "Unknown Agent"}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  {call.status === "completed" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  )}
                  {["failed", "busy", "no-answer", "canceled"].includes(call.status) && (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {call.status === "in-progress" && (
                    <Clock className="h-3.5 w-3.5 text-warning animate-pulse" />
                  )}
                  <span className="text-sm font-mono text-foreground">
                    {formatDuration(call.duration_seconds)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {getTimeAgo(call.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
