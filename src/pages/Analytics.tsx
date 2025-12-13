import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Phone, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

const weeklyData = [
  { day: "Mon", calls: 245, success: 198 },
  { day: "Tue", calls: 312, success: 267 },
  { day: "Wed", calls: 287, success: 234 },
  { day: "Thu", calls: 356, success: 312 },
  { day: "Fri", calls: 298, success: 256 },
  { day: "Sat", calls: 145, success: 123 },
  { day: "Sun", calls: 98, success: 87 },
];

const outcomeData = [
  { name: "Completed", value: 68, color: "hsl(142 76% 45%)" },
  { name: "Voicemail", value: 18, color: "hsl(38 92% 50%)" },
  { name: "No Answer", value: 10, color: "hsl(215 20% 55%)" },
  { name: "Failed", value: 4, color: "hsl(0 72% 51%)" },
];

const durationTrend = [
  { week: "W1", duration: 2.3 },
  { week: "W2", duration: 2.5 },
  { week: "W3", duration: 2.4 },
  { week: "W4", duration: 2.8 },
  { week: "W5", duration: 2.6 },
  { week: "W6", duration: 2.9 },
];

const agentPerformance = [
  { agent: "Sales Assistant", calls: 1247, rate: 78 },
  { agent: "Support Agent", calls: 892, rate: 92 },
  { agent: "Reminder Bot", calls: 2156, rate: 85 },
  { agent: "Collection Agent", calls: 743, rate: 67 },
];

export default function Analytics() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Performance insights and call metrics
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Calls (Week)"
          value="1,741"
          change="+15% vs last week"
          changeType="positive"
          icon={Phone}
        />
        <StatCard
          title="Success Rate"
          value="82%"
          change="+3%"
          changeType="positive"
          icon={CheckCircle2}
          iconColor="text-success"
        />
        <StatCard
          title="Avg. Duration"
          value="2:48"
          change="+12s"
          changeType="neutral"
          icon={Clock}
          iconColor="text-warning"
        />
        <StatCard
          title="Conversion Rate"
          value="24%"
          change="+5%"
          changeType="positive"
          icon={TrendingUp}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Call Volume */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="mb-6 font-semibold text-foreground">Weekly Call Volume</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(222 30% 18%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="hsl(215 20% 55%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(215 20% 55%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="calls"
                  fill="hsl(173 80% 50%)"
                  radius={[4, 4, 0, 0]}
                  name="Total Calls"
                />
                <Bar
                  dataKey="success"
                  fill="hsl(142 76% 45%)"
                  radius={[4, 4, 0, 0]}
                  name="Successful"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Call Outcomes */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="mb-6 font-semibold text-foreground">Call Outcomes</h3>
          <div className="flex items-center gap-8">
            <div className="h-[200px] w-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {outcomeData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {item.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Duration Trend */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="mb-6 font-semibold text-foreground">
            Avg. Call Duration Trend
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={durationTrend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(222 30% 18%)"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  stroke="hsl(215 20% 55%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(215 20% 55%)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[2, 3]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 10%)",
                    border: "1px solid hsl(222 30% 18%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value} min`, "Duration"]}
                />
                <Line
                  type="monotone"
                  dataKey="duration"
                  stroke="hsl(173 80% 50%)"
                  strokeWidth={2}
                  dot={{ fill: "hsl(173 80% 50%)", strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Performance */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="mb-6 font-semibold text-foreground">Agent Performance</h3>
          <div className="space-y-4">
            {agentPerformance.map((agent) => (
              <div key={agent.agent} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{agent.agent}</span>
                  <span className="text-muted-foreground">
                    {agent.calls.toLocaleString()} calls • {agent.rate}% success
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                    style={{ width: `${agent.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
