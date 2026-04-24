import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Phone, TrendingUp, Clock, CheckCircle2, Megaphone, BarChart3, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalls } from "@/hooks/useCalls";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAgents } from "@/hooks/useAgents";
import { format, subDays, subHours, eachDayOfInterval, eachHourOfInterval } from "date-fns";
import { useState } from "react";

export default function Analytics() {
  const [dateRange, setDateRange] = useState("30d");
  const navigate = useNavigate();
  // Global across ALL workspaces (no tenant filter) — admin analytics view.
  const { calls: allCalls, loading } = useCalls({ limit: 5000 });
  const { campaigns } = useCampaigns();
  const { agents } = useAgents();

  // Filter calls by date range
  const calls = useMemo(() => {
    if (dateRange === "all") return allCalls;
    if (dateRange === "24h") {
      const cutoff = subHours(new Date(), 24);
      return allCalls.filter((c) => new Date(c.created_at) >= cutoff);
    }
    const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : 90;
    const cutoff = subDays(new Date(), daysBack);
    return allCalls.filter((c) => new Date(c.created_at) >= cutoff);
  }, [allCalls, dateRange]);

  // Time-series data (hourly for 24h, daily otherwise) — split by inbound/outbound
  const dailyData = useMemo(() => {
    if (dateRange === "24h") {
      const now = new Date();
      const hours = eachHourOfInterval({ start: subHours(now, 23), end: now });
      return hours.map((hour) => {
        const hourStart = hour.getTime();
        const hourEnd = hourStart + 60 * 60 * 1000;
        const hourCalls = calls.filter((c) => {
          const t = new Date(c.created_at).getTime();
          return t >= hourStart && t < hourEnd;
        });
        return {
          day: format(hour, "HH:00"),
          inbound: hourCalls.filter((c) => c.direction === "inbound").length,
          outbound: hourCalls.filter((c) => c.direction === "outbound").length,
          calls: hourCalls.length,
          success: hourCalls.filter((c) => c.status === "completed").length,
        };
      });
    }
    const daysBack = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 30;
    const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCalls = calls.filter((c) => c.created_at.startsWith(dayStr));
      return {
        day: format(day, dateRange === "7d" ? "EEE" : "MMM dd"),
        inbound: dayCalls.filter((c) => c.direction === "inbound").length,
        outbound: dayCalls.filter((c) => c.direction === "outbound").length,
        calls: dayCalls.length,
        success: dayCalls.filter((c) => c.status === "completed").length,
      };
    });
  }, [calls, dateRange]);

  const outcomeData = useMemo(() => {
    const total = calls.length || 1;
    const completed = calls.filter((c) => c.status === "completed").length;
    const noAnswer = calls.filter((c) => ["no-answer", "busy"].includes(c.status)).length;
    const failed = calls.filter((c) => c.status === "failed").length;
    const inProgress = calls.filter((c) => ["in-progress", "ringing", "queued", "pending"].includes(c.status)).length;
    const other = calls.length - completed - noAnswer - failed - inProgress;
    return [
      { name: "Completed", value: Math.round((completed / total) * 100), count: completed, color: "hsl(142 76% 45%)" },
      { name: "No Answer", value: Math.round((noAnswer / total) * 100), count: noAnswer, color: "hsl(38 92% 50%)" },
      { name: "Failed", value: Math.round((failed / total) * 100), count: failed, color: "hsl(0 72% 51%)" },
      { name: "In Progress", value: Math.round((inProgress / total) * 100), count: inProgress, color: "hsl(215 80% 55%)" },
      { name: "Other", value: Math.round((other / total) * 100), count: other, color: "hsl(215 20% 55%)" },
    ].filter((o) => o.value > 0);
  }, [calls]);

  // Agent performance from real data
  const agentPerformance = useMemo(() => {
    return agents.map((agent) => {
      const agentCalls = calls.filter((c) => c.agent_id === agent.id);
      const completed = agentCalls.filter((c) => c.status === "completed").length;
      const totalDur = agentCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
      const rate = agentCalls.length > 0 ? Math.round((completed / agentCalls.length) * 100) : 0;
      return { agent: agent.name, calls: agentCalls.length, rate, minutes: Math.round(totalDur / 60) };
    }).filter((a) => a.calls > 0).sort((a, b) => b.calls - a.calls);
  }, [calls, agents]);

  // Overall stats
  const totalCalls = calls.length;
  const completedCalls = calls.filter((c) => c.status === "completed");
  const successRate = totalCalls > 0 ? Math.round((completedCalls.length / totalCalls) * 100) : 0;
  const totalDuration = completedCalls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
  const avgDurationSec = completedCalls.length > 0 ? totalDuration / completedCalls.length : 0;
  const avgMin = Math.floor(avgDurationSec / 60);
  const avgSec = Math.round(avgDurationSec % 60);
  const totalMinutes = Math.round(totalDuration / 60);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Global performance insights — all data from live calls</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <CalendarIcon className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="14d">Last 14 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign Quick Access */}
      {campaigns.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Megaphone className="h-4 w-4" />Campaign Analytics
            </h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {campaigns.map((campaign) => {
              const campCalls = calls.filter((c) => c.campaign_id === campaign.id);
              return (
                <Button key={campaign.id} variant="outline" className="justify-between h-auto py-3 px-4" onClick={() => navigate(`/campaigns/${campaign.id}/analytics`)}>
                  <div className="text-left">
                    <p className="font-medium text-sm">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">{campCalls.length} calls</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${campaign.status === "active" ? "bg-success" : campaign.status === "paused" ? "bg-warning" : "bg-muted-foreground"}`} />
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Calls" value={totalCalls.toLocaleString()} change={dateRange === "all" ? "All time" : `Last ${dateRange}`} changeType="neutral" icon={Phone} />
          <StatCard title="Success Rate" value={`${successRate}%`} change={`${completedCalls.length} completed`} changeType={successRate > 70 ? "positive" : successRate > 0 ? "negative" : "neutral"} icon={CheckCircle2} iconColor="text-success" />
          <StatCard title="Avg. Duration" value={`${avgMin}:${avgSec.toString().padStart(2, "0")}`} change="Per completed call" changeType="neutral" icon={Clock} iconColor="text-warning" />
          <StatCard title="Total Minutes" value={totalMinutes.toLocaleString()} change="Talk time" changeType="neutral" icon={TrendingUp} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Call Volume {dateRange === "24h" ? "(hourly)" : "(daily)"}</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: "hsl(142 76% 45%)" }} />
                  <span className="text-muted-foreground">Inbound</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: "hsl(173 80% 50%)" }} />
                  <span className="text-muted-foreground">Outbound</span>
                </div>
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="inbound" stackId="calls" fill="hsl(142 76% 45%)" radius={[0, 0, 0, 0]} name="Inbound" />
                  <Bar dataKey="outbound" stackId="calls" fill="hsl(173 80% 50%)" radius={[4, 4, 0, 0]} name="Outbound" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="mb-6 font-semibold text-foreground">Call Outcomes</h3>
            {outcomeData.length > 0 ? (
              <div className="flex items-center gap-8">
                <div className="h-[200px] w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                        {outcomeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {outcomeData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-foreground">{item.value}% ({item.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">No calls yet</div>
            )}
          </div>

          {/* Agent Performance */}
          <div className="glass-card rounded-xl p-6 lg:col-span-2">
            <h3 className="mb-6 font-semibold text-foreground">Agent Performance</h3>
            {agentPerformance.length > 0 ? (
              <div className="space-y-4">
                {agentPerformance.map((agent) => (
                  <div key={agent.agent} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{agent.agent}</span>
                      <span className="text-muted-foreground">{agent.calls} calls • {agent.rate}% success • {agent.minutes} min</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-primary transition-all duration-500" style={{ width: `${agent.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">No agent call data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
