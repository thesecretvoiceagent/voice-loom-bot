import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentCalls } from "@/components/dashboard/RecentCalls";
import { AgentStatus } from "@/components/dashboard/AgentStatus";
import { CallChart } from "@/components/dashboard/CallChart";

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Overview of your AI voice platform performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Calls Today"
          value="213"
          change="+12% from yesterday"
          changeType="positive"
          icon={Phone}
        />
        <StatCard
          title="Inbound Calls"
          value="124"
          change="+8%"
          changeType="positive"
          icon={PhoneIncoming}
          iconColor="text-success"
        />
        <StatCard
          title="Outbound Calls"
          value="89"
          change="+18%"
          changeType="positive"
          icon={PhoneOutgoing}
        />
        <StatCard
          title="Avg. Duration"
          value="2:45"
          change="-5s"
          changeType="neutral"
          icon={Clock}
          iconColor="text-warning"
        />
      </div>

      {/* Chart */}
      <CallChart />

      {/* Two Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentCalls />
        <AgentStatus />
      </div>
    </div>
  );
}
