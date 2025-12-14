import { useParams, useNavigate, Link } from "react-router-dom";
import { useState, useMemo } from "react";
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
import { Phone, TrendingUp, Clock, CheckCircle2, DollarSign, Users, ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";

// Campaign data with unique analytics
const campaignData: Record<string, {
  name: string;
  description: string;
  status: string;
  agent: string;
  startDate: string;
  endDate: string;
  metrics: {
    totalCalls: number;
    successRate: number;
    avgDuration: number;
    conversionRate: number;
    totalMinutes: number;
  };
  dailyData: { date: string; calls: number; success: number }[];
  outcomes: { name: string; value: number; color: string }[];
  durationTrend: { week: string; duration: number }[];
}> = {
  "1": {
    name: "Q4 Sales Outreach",
    description: "End of year product promotion calls",
    status: "active",
    agent: "Sales Assistant",
    startDate: "Dec 1, 2025",
    endDate: "Dec 31, 2025",
    metrics: {
      totalCalls: 876,
      successRate: 72,
      avgDuration: 3.2,
      conversionRate: 28,
      totalMinutes: 2803,
    },
    dailyData: [
      { date: "Dec 8", calls: 145, success: 105 },
      { date: "Dec 9", calls: 167, success: 124 },
      { date: "Dec 10", calls: 134, success: 98 },
      { date: "Dec 11", calls: 189, success: 142 },
      { date: "Dec 12", calls: 156, success: 118 },
      { date: "Dec 13", calls: 85, success: 67 },
      { date: "Dec 14", calls: 0, success: 0 },
    ],
    outcomes: [
      { name: "Converted", value: 28, color: "hsl(142 76% 45%)" },
      { name: "Interested", value: 44, color: "hsl(173 80% 50%)" },
      { name: "Not Interested", value: 18, color: "hsl(38 92% 50%)" },
      { name: "No Answer", value: 10, color: "hsl(215 20% 55%)" },
    ],
    durationTrend: [
      { week: "W1", duration: 2.8 },
      { week: "W2", duration: 3.1 },
      { week: "W3", duration: 3.4 },
    ],
  },
  "2": {
    name: "Payment Reminders",
    description: "Monthly payment reminder campaign",
    status: "active",
    agent: "Reminder Bot",
    startDate: "Dec 10, 2025",
    endDate: "Dec 15, 2025",
    metrics: {
      totalCalls: 1890,
      successRate: 89,
      avgDuration: 1.8,
      conversionRate: 76,
      totalMinutes: 3402,
    },
    dailyData: [
      { date: "Dec 10", calls: 412, success: 378 },
      { date: "Dec 11", calls: 456, success: 412 },
      { date: "Dec 12", calls: 389, success: 342 },
      { date: "Dec 13", calls: 423, success: 376 },
      { date: "Dec 14", calls: 210, success: 182 },
    ],
    outcomes: [
      { name: "Payment Confirmed", value: 76, color: "hsl(142 76% 45%)" },
      { name: "Scheduled", value: 13, color: "hsl(173 80% 50%)" },
      { name: "Voicemail", value: 7, color: "hsl(38 92% 50%)" },
      { name: "Failed", value: 4, color: "hsl(0 72% 51%)" },
    ],
    durationTrend: [
      { week: "W1", duration: 1.6 },
      { week: "W2", duration: 1.9 },
    ],
  },
  "3": {
    name: "Customer Satisfaction Survey",
    description: "Post-service satisfaction survey",
    status: "paused",
    agent: "Survey Bot",
    startDate: "Nov 15, 2025",
    endDate: "Dec 20, 2025",
    metrics: {
      totalCalls: 234,
      successRate: 65,
      avgDuration: 4.2,
      conversionRate: 52,
      totalMinutes: 983,
    },
    dailyData: [
      { date: "Nov 15", calls: 45, success: 32 },
      { date: "Nov 16", calls: 38, success: 24 },
      { date: "Nov 17", calls: 52, success: 36 },
      { date: "Nov 18", calls: 48, success: 30 },
      { date: "Nov 19", calls: 51, success: 30 },
    ],
    outcomes: [
      { name: "Survey Complete", value: 52, color: "hsl(142 76% 45%)" },
      { name: "Partial", value: 13, color: "hsl(173 80% 50%)" },
      { name: "Declined", value: 20, color: "hsl(38 92% 50%)" },
      { name: "No Answer", value: 15, color: "hsl(215 20% 55%)" },
    ],
    durationTrend: [
      { week: "W1", duration: 3.8 },
      { week: "W2", duration: 4.1 },
      { week: "W3", duration: 4.4 },
      { week: "W4", duration: 4.2 },
    ],
  },
  "4": {
    name: "Debt Collection Wave 3",
    description: "Third wave of collection calls for overdue accounts",
    status: "scheduled",
    agent: "Collection Agent",
    startDate: "Dec 18, 2025",
    endDate: "Dec 25, 2025",
    metrics: {
      totalCalls: 0,
      successRate: 0,
      avgDuration: 0,
      conversionRate: 0,
      totalMinutes: 0,
    },
    dailyData: [],
    outcomes: [
      { name: "No Data Yet", value: 100, color: "hsl(215 20% 55%)" },
    ],
    durationTrend: [],
  },
};

const allCampaigns = Object.entries(campaignData).map(([id, data]) => ({
  id,
  name: data.name,
}));

const HOURLY_RATE = 12;

export default function CampaignAnalytics() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("7d");

  const campaign = campaignId ? campaignData[campaignId] : null;

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button variant="outline" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const { metrics } = campaign;
  const humanHours = metrics.totalMinutes / 60;
  const humanCost = humanHours * HOURLY_RATE;
  const aiCost = metrics.totalMinutes * 0.20;
  const savings = humanCost - aiCost;
  const savingsPercentage = humanCost > 0 ? ((savings / humanCost) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{campaign.name}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  campaign.status === "active"
                    ? "bg-success/10 text-success"
                    : campaign.status === "paused"
                    ? "bg-warning/10 text-warning"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {campaign.status === "active" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                )}
                {campaign.status}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{campaign.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Campaign Info Banner */}
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>{campaign.startDate} - {campaign.endDate}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>Agent: {campaign.agent}</span>
          </div>
        </div>
        <Select value={campaignId} onValueChange={(id) => navigate(`/campaigns/${id}/analytics`)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Switch campaign" />
          </SelectTrigger>
          <SelectContent>
            {allCampaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              title="Total Calls"
              value={metrics.totalCalls.toLocaleString()}
              change="This campaign"
              changeType="neutral"
              icon={Phone}
            />
            <StatCard
              title="Success Rate"
              value={`${metrics.successRate}%`}
              change={metrics.successRate > 70 ? "Above target" : "Below target"}
              changeType={metrics.successRate > 70 ? "positive" : "negative"}
              icon={CheckCircle2}
              iconColor="text-success"
            />
            <StatCard
              title="Avg. Duration"
              value={`${metrics.avgDuration}m`}
              change="Per call"
              changeType="neutral"
              icon={Clock}
              iconColor="text-warning"
            />
            <StatCard
              title="Conversion Rate"
              value={`${metrics.conversionRate}%`}
              change={metrics.conversionRate > 25 ? "Strong" : "Needs improvement"}
              changeType={metrics.conversionRate > 25 ? "positive" : "neutral"}
              icon={TrendingUp}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Daily Call Volume */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-6 font-semibold text-foreground">Daily Call Volume</h3>
              {campaign.dailyData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campaign.dailyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(222 30% 18%)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
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
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  No call data yet - campaign is scheduled
                </div>
              )}
            </div>

            {/* Call Outcomes */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-6 font-semibold text-foreground">Call Outcomes</h3>
              <div className="flex items-center gap-8">
                <div className="h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={campaign.outcomes}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {campaign.outcomes.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {campaign.outcomes.map((item) => (
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
            <div className="glass-card rounded-xl p-6 lg:col-span-2">
              <h3 className="mb-6 font-semibold text-foreground">
                Avg. Call Duration Trend
              </h3>
              {campaign.durationTrend.length > 0 ? (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={campaign.durationTrend}>
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
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
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
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No trend data yet - campaign is scheduled
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roi" className="mt-6 space-y-6">
          {metrics.totalCalls === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No ROI data available yet - this campaign hasn't started</p>
            </div>
          ) : (
            <>
              {/* ROI Stats */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Hours Saved"
                  value={`${humanHours.toFixed(1)}h`}
                  change="This campaign"
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
                        {humanHours.toFixed(1)} hours × €{HOURLY_RATE}/hour
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
                        {metrics.totalMinutes} minutes × €0.20/minute
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
                        <p className="text-2xl font-bold text-foreground">{humanHours.toFixed(1)} hours</p>
                        <p className="text-sm text-muted-foreground">Saved from human workload</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                        <p className="text-2xl font-bold text-foreground">{metrics.totalCalls}</p>
                        <p className="text-sm text-muted-foreground">Total Calls</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                        <p className="text-2xl font-bold text-foreground">{metrics.avgDuration}m</p>
                        <p className="text-sm text-muted-foreground">Avg. Duration</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <p className="text-sm text-muted-foreground mb-1">Equivalent FTE Savings</p>
                      <p className="text-lg font-semibold text-foreground">
                        {(humanHours / 40).toFixed(2)} work weeks
                      </p>
                      <p className="text-xs text-muted-foreground">Based on 40-hour work week</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
