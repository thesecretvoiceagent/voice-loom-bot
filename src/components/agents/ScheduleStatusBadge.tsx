import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { evaluateSchedule, describeScheduleBlock, type AgentSchedule } from "@/lib/agentSchedule";
import { cn } from "@/lib/utils";

export function ScheduleStatusBadge({ schedule }: { schedule: AgentSchedule }) {
  const [status, setStatus] = useState(() => evaluateSchedule(schedule));

  useEffect(() => {
    setStatus(evaluateSchedule(schedule));
    const id = setInterval(() => setStatus(evaluateSchedule(schedule)), 30_000);
    return () => clearInterval(id);
  }, [schedule?.start_time, schedule?.end_time, schedule?.timezone, JSON.stringify(schedule?.days)]);

  const ok = status.allowed;
  return (
    <div
      title={describeScheduleBlock(status, schedule)}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      <span>
        {ok ? "Open now" : "Closed now"} · {status.localTime} {status.dayKey.toUpperCase()} · {status.timezone}
      </span>
    </div>
  );
}
