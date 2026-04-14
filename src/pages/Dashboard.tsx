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

export default function Dashboard() {
  const { calls, loading, stats, chartData } = useCalls({ limit: 500 });

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
          title="Total Calls Today"
          value={loading ? "—" : stats.totalToday.toString()}
          icon={Phone}
        />
        <StatCard
          title="Inbound Calls"
          value={loading ? "—" : stats.inboundToday.toString()}
          icon={PhoneIncoming}
          iconColor="text-success"
        />
        <StatCard
          title="Outbound Calls"
          value={loading ? "—" : stats.outboundToday.toString()}
          icon={PhoneOutgoing}
        />
        <StatCard
          title="Avg. Duration"
          value={loading ? "—" : stats.avgDuration}
          icon={Clock}
          iconColor="text-warning"
        />
      </div>

      {/* Chart */}
      <CallChart data={chartData} loading={loading} />

      {/* Two Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentCalls calls={calls.slice(0, 8)} loading={loading} />
        <AgentStatus calls={calls} loading={loading} />
      </div>
    </div>
  );
}
