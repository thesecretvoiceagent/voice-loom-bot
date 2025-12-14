import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Phone, TrendingUp, Clock, CheckCircle2, DollarSign, Users, Megaphone, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

// Campaign list for quick access
const campaigns = [
  { id: "1", name: "Q4 Sales Outreach", status: "active", calls: 876 },
  { id: "2", name: "Payment Reminders", status: "active", calls: 1890 },
  { id: "3", name: "Customer Satisfaction Survey", status: "paused", calls: 234 },
  { id: "4", name: "Debt Collection Wave 3", status: "scheduled", calls: 0 },
];

// ROI Data (assuming 12€/hr for human employee)
const HOURLY_RATE = 12;
const roiData = {
  totalCallMinutes: 4532,
  avgCallDuration: 2.8, // minutes
  totalCalls: 1741,
  humanHandledTime: 4532 / 60, // hours
  aiCostPerMinute: 0.20,
  humanCostPerHour: HOURLY_RATE,
};

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();

  const humanCost = roiData.humanHandledTime * roiData.humanCostPerHour;
  const aiCost = roiData.totalCallMinutes * roiData.aiCostPerMinute;
  const savings = humanCost - aiCost;
  const savingsPercentage = ((savings / humanCost) * 100).toFixed(1);
  const hoursSaved = roiData.humanHandledTime;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Performance insights and call metrics
        </p>
      </div>

      {/* Campaign Quick Access */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campaign Analytics
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {campaigns.map((campaign) => (
            <Button
              key={campaign.id}
              variant="outline"
              className="justify-between h-auto py-3 px-4"
              onClick={() => navigate(`/campaigns/${campaign.id}/analytics`)}
            >
              <div className="text-left">
                <p className="font-medium text-sm">{campaign.name}</p>
                <p className="text-xs text-muted-foreground">{campaign.calls.toLocaleString()} calls</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    campaign.status === "active"
                      ? "bg-success"
                      : campaign.status === "paused"
                      ? "bg-warning"
                      : "bg-muted-foreground"
                  }`}
                />
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger 
            value="overview" 
            className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="roi" 
            className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <DollarSign className="h-4 w-4" />
            ROI & Time Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
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
        </TabsContent>

        <TabsContent value="roi" className="mt-6 space-y-6">
          {/* ROI Stats */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Hours Saved"
              value={`${hoursSaved.toFixed(1)}h`}
              change="This week"
              changeType="positive"
              icon={Clock}
              iconColor="text-success"
            />
            <StatCard
              title="Human Cost (€12/hr)"
              value={`€${humanCost.toFixed(2)}`}
              change="If handled manually"
              changeType="neutral"
              icon={Users}
            />
            <StatCard
              title="AI Cost"
              value={`€${aiCost.toFixed(2)}`}
              change="€0.20/min"
              changeType="positive"
              icon={DollarSign}
              iconColor="text-primary"
            />
            <StatCard
              title="Total Savings"
              value={`€${savings.toFixed(2)}`}
              change={`${savingsPercentage}% less`}
              changeType="positive"
              icon={TrendingUp}
              iconColor="text-success"
            />
          </div>

          {/* ROI Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-4">Cost Comparison</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Human Employee Cost</span>
                    <span className="font-medium text-foreground">€{humanCost.toFixed(2)}</span>
                  </div>
                  <div className="h-4 rounded-full bg-destructive/20 overflow-hidden">
                    <div className="h-full rounded-full bg-destructive" style={{ width: '100%' }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hoursSaved.toFixed(1)} hours × €{HOURLY_RATE}/hour
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">AI Voice Agent Cost</span>
                    <span className="font-medium text-foreground">€{aiCost.toFixed(2)}</span>
                  </div>
                  <div className="h-4 rounded-full bg-success/20 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-success" 
                      style={{ width: `${(aiCost / humanCost) * 100}%` }} 
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {roiData.totalCallMinutes} minutes × €0.20/minute
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Net Savings</span>
                    <span className="text-xl font-bold text-success">€{savings.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    You saved {savingsPercentage}% compared to human employees
                  </p>
                </div>
              </div>
            </Card>

            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-4">Time Savings Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-success/10 border border-success/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/20">
                    <Clock className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{hoursSaved.toFixed(1)} hours</p>
                    <p className="text-sm text-muted-foreground">Saved from human workload</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <p className="text-2xl font-bold text-foreground">{roiData.totalCalls}</p>
                    <p className="text-sm text-muted-foreground">Total Calls Handled</p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <p className="text-2xl font-bold text-foreground">{roiData.avgCallDuration}m</p>
                    <p className="text-sm text-muted-foreground">Avg. Call Duration</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Equivalent FTE Savings</p>
                  <p className="text-lg font-semibold text-foreground">
                    {(hoursSaved / 40).toFixed(2)} work weeks
                  </p>
                  <p className="text-xs text-muted-foreground">Based on 40-hour work week</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
