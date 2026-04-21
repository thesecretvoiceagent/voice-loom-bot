import { useMemo, useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentCalls } from "@/components/dashboard/RecentCalls";
import { AgentStatus } from "@/components/dashboard/AgentStatus";
import { CallChart } from "@/components/dashboard/CallChart";
import { useCalls } from "@/hooks/useCalls";
import { Button } from "@/components/ui/button";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";

type RangeKey = "7d" | "14d" | "90d" | "180d";

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "14d", label: "14 days", days: 14 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "180d", label: "180 days", days: 180 },
];

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>("7d");
  const days = RANGES.find((r) => r.key === range)?.days ?? 7;

  // Pull a generous window so we can slice in-memory for any selected range
  const { calls, loading } = useCalls({ limit: 2000 });

  const filteredCalls = useMemo(() => {
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return calls.filter((c) => new Date(c.created_at) >= cutoff);
  }, [calls, days]);

  const stats = useMemo(() => {
    const inbound = filteredCalls.filter((c) => c.direction === "inbound");
    const outbound = filteredCalls.filter((c) => c.direction === "outbound");
    const completed = filteredCalls.filter((c) => c.status === "completed");
    const totalDuration = completed.reduce(
      (s, c) => s + (c.duration_seconds || 0),
      0
    );
    const avg = completed.length > 0 ? totalDuration / completed.length : 0;
    const avgMin = Math.floor(avg / 60);
    const avgSec = Math.round(avg % 60);
    return {
      total: filteredCalls.length,
      inbound: inbound.length,
      outbound: outbound.length,
      avgDuration: `${avgMin}:${avgSec.toString().padStart(2, "0")}`,
    };
  }, [filteredCalls]);

  const chartData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, days - 1);
    const interval = eachDayOfInterval({ start, end });
    return interval.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      const dayCalls = filteredCalls.filter((c) =>
        c.created_at.startsWith(key)
      );
      return {
        time: format(day, days <= 14 ? "MMM dd" : "MMM d"),
        inbound: dayCalls.filter((c) => c.direction === "inbound").length,
        outbound: dayCalls.filter((c) => c.direction === "outbound").length,
      };
    });
  }, [filteredCalls, days]);

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "7 days";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your AI voice platform performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={`Total Calls (${rangeLabel})`}
          value={loading ? "—" : stats.total.toString()}
          icon={Phone}
        />
        <StatCard
          title="Inbound Calls"
          value={loading ? "—" : stats.inbound.toString()}
          icon={PhoneIncoming}
          iconColor="text-success"
        />
        <StatCard
          title="Outbound Calls"
          value={loading ? "—" : stats.outbound.toString()}
          icon={PhoneOutgoing}
        />
        <StatCard
          title="Avg. Duration"
          value={loading ? "—" : stats.avgDuration}
          icon={Clock}
          iconColor="text-warning"
        />
      </div>

      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Time range:</span>
        {RANGES.map((r) => (
          <Button
            key={r.key}
            size="sm"
            variant={range === r.key ? "default" : "outline"}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Chart */}
      <CallChart data={chartData} loading={loading} title={`Call Volume (Last ${rangeLabel})`} />

      {/* Two Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentCalls calls={filteredCalls.slice(0, 8)} loading={loading} />
        <AgentStatus calls={filteredCalls} loading={loading} />
      </div>
    </div>
  );
}
