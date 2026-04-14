import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { Phone, TrendingUp, Clock, CheckCircle2, DollarSign, Users, Megaphone, BarChart3, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCalls } from "@/hooks/useCalls";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAgents } from "@/hooks/useAgents";
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";

const HOURLY_RATE = 12;

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const navigate = useNavigate();
  const { calls, loading } = useCalls({ limit: 1000 });
  const { campaigns } = useCampaigns();
  const { agents } = useAgents();

  // Weekly data (last 7 days)
  const weeklyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayCalls = calls.filter((c) => c.created_at.startsWith(dayStr));
      const success = dayCalls.filter((c) => c.status === "completed").length;
      return { day: format(day, "EEE"), calls: dayCalls.length, success };
    });
  }, [calls]);

  const outcomeData = useMemo(() => {
    const total = calls.length || 1;
    const completed = calls.filter((c) => c.status === "completed").length;
    const noAnswer = calls.filter((c) => ["no-answer", "busy"].includes(c.status)).length;
    const failed = calls.filter((c) => c.status === "failed").length;
    const other = calls.length - completed - noAnswer - failed;
    return [
      { name: "Completed", value: Math.round((completed / total) * 100), color: "hsl(142 76% 45%)" },
      { name: "No Answer", value: Math.round((noAnswer / total) * 100), color: "hsl(38 92% 50%)" },
      { name: "Failed", value: Math.round((failed / total) * 100), color: "hsl(0 72% 51%)" },
      { name: "Other", value: Math.round((other / total) * 100), color: "hsl(215 20% 55%)" },
    ].filter((o) => o.value > 0);
  }, [calls]);

  // Agent performance from real data
  const agentPerformance = useMemo(() => {
    return agents.map((agent) => {
      const agentCalls = calls.filter((c) => c.agent_id === agent.id);
      const completed = agentCalls.filter((c) => c.status === "completed").length;
      const rate = agentCalls.length > 0 ? Math.round((completed / agentCalls.length) * 100) : 0;
      return { agent: agent.name, calls: agentCalls.length, rate };
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

  // ROI
  const humanHours = totalMinutes / 60;
  const humanCost = humanHours * HOURLY_RATE;
  const aiCost = totalMinutes * 0.20;
  const savings = humanCost - aiCost;
  const savingsPercentage = humanCost > 0 ? ((savings / humanCost) * 100).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Performance insights and call metrics</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Overview</TabsTrigger>
          <TabsTrigger value="roi" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <DollarSign className="h-4 w-4" />ROI & Time Saved
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Calls" value={totalCalls.toLocaleString()} change="All time" changeType="neutral" icon={Phone} />
            <StatCard title="Success Rate" value={`${successRate}%`} change={successRate > 70 ? "Above target" : "Below target"} changeType={successRate > 70 ? "positive" : "negative"} icon={CheckCircle2} iconColor="text-success" />
            <StatCard title="Avg. Duration" value={`${avgMin}:${avgSec.toString().padStart(2, "0")}`} change="Per completed call" changeType="neutral" icon={Clock} iconColor="text-warning" />
            <StatCard title="Total Minutes" value={totalMinutes.toLocaleString()} change="Talk time" changeType="neutral" icon={TrendingUp} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-xl p-6">
              <h3 className="mb-6 font-semibold text-foreground">Weekly Call Volume</h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="calls" fill="hsl(173 80% 50%)" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="success" fill="hsl(142 76% 45%)" radius={[4, 4, 0, 0]} name="Successful" />
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
                        <span className="text-sm font-medium text-foreground">{item.value}%</span>
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
                        <span className="text-foreground">{agent.agent}</span>
                        <span className="text-muted-foreground">{agent.calls} calls • {agent.rate}% success</span>
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
        </TabsContent>

        <TabsContent value="roi" className="mt-6 space-y-6">
          {totalCalls === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <p className="text-muted-foreground">No ROI data available yet - make some calls first</p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Hours Saved" value={`${humanHours.toFixed(1)}h`} change="All time" changeType="positive" icon={Clock} iconColor="text-success" />
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
                      <p className="text-xs text-muted-foreground mt-1">{totalMinutes} minutes × €0.20/minute</p>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Net Savings</span>
                        <span className="text-xl font-bold text-success">€{savings.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">You saved {savingsPercentage}% compared to human employees</p>
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
                        <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
                        <p className="text-sm text-muted-foreground">Total Calls Handled</p>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                        <p className="text-2xl font-bold text-foreground">{totalMinutes}</p>
                        <p className="text-sm text-muted-foreground">Total Minutes</p>
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
