import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Phone, TrendingUp, Clock, CheckCircle2, DollarSign, Users, ArrowLeft, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalls } from "@/hooks/useCalls";
import { useCampaigns } from "@/hooks/useCampaigns";
import { format, subDays, eachDayOfInterval } from "date-fns";

const HOURLY_RATE = 12;

export default function CampaignAnalytics() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");

  const { campaigns } = useCampaigns();
  const { calls, loading } = useCalls({ campaign_id: campaignId, limit: 1000, realtime: true });

  const campaign = campaigns.find((c) => c.id === campaignId);

  const filteredCalls = useMemo(() => {
    const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 365;
    const cutoff = subDays(new Date(), daysBack);
    return calls.filter((c) => new Date(c.created_at) >= cutoff);
  }, [calls, dateRange]);

  const metrics = useMemo(() => {
    const total = filteredCalls.length;
    const completed = filteredCalls.filter((c) => c.status === "completed");
    const totalDuration = completed.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    const avgDuration = completed.length > 0 ? totalDuration / completed.length / 60 : 0;
    const successRate = total > 0 ? (completed.length / total) * 100 : 0;
    return {
      totalCalls: total,
      successRate: Math.round(successRate),
      avgDuration: Math.round(avgDuration * 10) / 10,
      totalMinutes: Math.round(totalDuration / 60),
    };
  }, [filteredCalls]);

  const dailyData = useMemo(() => {
    const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 90;
    const interval = eachDayOfInterval({ start: subDays(new Date(), daysBack), end: new Date() });
    return interval.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCalls = filteredCalls.filter((c) => c.created_at.startsWith(dayStr));
      const success = dayCalls.filter((c) => c.status === "completed").length;
      return { date: format(day, "MMM dd"), calls: dayCalls.length, success };
    }).filter((d) => d.calls > 0);
  }, [filteredCalls, dateRange]);

  const outcomes = useMemo(() => {
    const total = filteredCalls.length || 1;
    const completed = filteredCalls.filter((c) => c.status === "completed").length;
    const noAnswer = filteredCalls.filter((c) => ["no-answer", "busy"].includes(c.status)).length;
    const failed = filteredCalls.filter((c) => c.status === "failed").length;
    const other = filteredCalls.length - completed - noAnswer - failed;
    return [
      { name: "Completed", value: Math.round((completed / total) * 100), color: "hsl(142 76% 45%)" },
      { name: "No Answer", value: Math.round((noAnswer / total) * 100), color: "hsl(38 92% 50%)" },
      { name: "Failed", value: Math.round((failed / total) * 100), color: "hsl(0 72% 51%)" },
      { name: "Other", value: Math.round((other / total) * 100), color: "hsl(215 20% 55%)" },
    ].filter((o) => o.value > 0);
  }, [filteredCalls]);

  // ROI calculations
  const humanHours = metrics.totalMinutes / 60;
  const humanCost = humanHours * HOURLY_RATE;
  const aiCost = metrics.totalMinutes * 0.20;
  const savings = humanCost - aiCost;
  const savingsPercentage = humanCost > 0 ? ((savings / humanCost) * 100).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button variant="outline" onClick={() => navigate("/campaigns")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Campaigns
        </Button>
      </div>
    );
  }

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
              <h1 className="text-3xl font-bold gradient-text">{campaign.name}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                campaign.status === "active" ? "bg-success/10 text-success" : campaign.status === "paused" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
              }`}>
                {campaign.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
                {campaign.status}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{campaign.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <CalendarIcon className="h-4 w-4 mr-2" /><SelectValue />
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

      {/* Campaign switcher */}
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            <span>{campaign.start_date || "—"} → {campaign.end_date || "—"}</span>
          </div>
        </div>
        <Select value={campaignId} onValueChange={(id) => navigate(`/campaigns/${id}/analytics`)}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Switch campaign" /></SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="roi" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <DollarSign className="h-4 w-4" />ROI & Time Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Calls" value={metrics.totalCalls.toLocaleString()} change="This campaign" changeType="neutral" icon={Phone} />
            <StatCard title="Success Rate" value={`${metrics.successRate}%`} change={metrics.successRate > 70 ? "Above target" : "Below target"} changeType={metrics.successRate > 70 ? "positive" : "negative"} icon={CheckCircle2} iconColor="text-success" />
            <StatCard title="Avg. Duration" value={`${metrics.avgDuration}m`} change="Per call" changeType="neutral" icon={Clock} iconColor="text-warning" />
            <StatCard title="Total Minutes" value={metrics.totalMinutes.toLocaleString()} change="Talk time" changeType="neutral" icon={TrendingUp} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-6 font-semibold text-foreground">Daily Call Volume</h3>
              {dailyData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="calls" fill="hsl(173 80% 50%)" radius={[4, 4, 0, 0]} name="Total" />
                      <Bar dataKey="success" fill="hsl(142 76% 45%)" radius={[4, 4, 0, 0]} name="Successful" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">No call data yet</div>
              )}
            </div>

            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-6 font-semibold text-foreground">Call Outcomes</h3>
              {outcomes.length > 0 ? (
                <div className="flex items-center gap-8">
                  <div className="h-[200px] w-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={outcomes} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                          {outcomes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-3">
                    {outcomes.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">No data</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roi" className="mt-6 space-y-6">
          {metrics.totalCalls === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No ROI data available yet</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Hours Saved" value={`${humanHours.toFixed(1)}h`} change="This campaign" changeType="positive" icon={Clock} iconColor="text-success" />
                <StatCard title="Human Cost (€12/hr)" value={`€${humanCost.toFixed(2)}`} change="If handled manually" changeType="neutral" icon={Users} />
                <StatCard title="AI Cost" value={`€${aiCost.toFixed(2)}`} change="€0.20/min" changeType="positive" icon={DollarSign} iconColor="text-primary" />
                <StatCard title="Total Savings" value={`€${savings.toFixed(2)}`} change={`${savingsPercentage}% less`} changeType="positive" icon={TrendingUp} iconColor="text-success" />
              </div>

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
                      <p className="text-xs text-muted-foreground mt-1">{humanHours.toFixed(1)} hours × €{HOURLY_RATE}/hour</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">AI Voice Agent Cost</span>
                        <span className="font-medium text-foreground">€{aiCost.toFixed(2)}</span>
                      </div>
                      <div className="h-4 rounded-full bg-success/20 overflow-hidden">
                        <div className="h-full rounded-full bg-success" style={{ width: `${humanCost > 0 ? (aiCost / humanCost) * 100 : 0}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{metrics.totalMinutes} minutes × €0.20/minute</p>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Net Savings</span>
                        <span className="text-xl font-bold text-success">€{savings.toFixed(2)}</span>
                      </div>
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
                      <p className="text-lg font-semibold text-foreground">{(humanHours / 40).toFixed(2)} work weeks</p>
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
