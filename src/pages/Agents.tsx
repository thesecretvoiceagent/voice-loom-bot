import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Phone,
  Clock,
  TrendingUp,
  Circle,
  Settings2,
  Play,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";

const agents = [
  {
    id: 1,
    name: "Sales Assistant",
    description: "Handles inbound sales inquiries and qualifies leads",
    status: "active",
    type: "inbound",
    totalCalls: 1247,
    avgDuration: "2:34",
    successRate: 78,
    lastActive: "2 min ago",
  },
  {
    id: 2,
    name: "Support Agent",
    description: "Customer support and issue resolution",
    status: "active",
    type: "inbound",
    totalCalls: 892,
    avgDuration: "4:12",
    successRate: 92,
    lastActive: "1 min ago",
  },
  {
    id: 3,
    name: "Reminder Bot",
    description: "Automated payment and appointment reminders",
    status: "idle",
    type: "outbound",
    totalCalls: 2156,
    avgDuration: "1:05",
    successRate: 85,
    lastActive: "15 min ago",
  },
  {
    id: 4,
    name: "Collection Agent",
    description: "Debt collection and payment arrangements",
    status: "active",
    type: "outbound",
    totalCalls: 743,
    avgDuration: "3:45",
    successRate: 67,
    lastActive: "5 min ago",
  },
  {
    id: 5,
    name: "Survey Bot",
    description: "Customer satisfaction surveys and feedback collection",
    status: "paused",
    type: "outbound",
    totalCalls: 534,
    avgDuration: "2:15",
    successRate: 71,
    lastActive: "2 hours ago",
  },
];

export default function Agents() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Voice Agents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage and configure your AI voice agents
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create Agent
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          All Types
        </Button>
        <Button variant="outline" size="sm">
          All Status
        </Button>
      </div>

      {/* Agents Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredAgents.map((agent, index) => (
          <div
            key={agent.id}
            className="glass-card glow-border rounded-xl p-6 transition-all duration-300 hover:shadow-elevated"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary">
                    <Bot className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <Circle
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current rounded-full border-2 border-card",
                      agent.status === "active" && "text-success",
                      agent.status === "idle" && "text-muted-foreground",
                      agent.status === "paused" && "text-warning"
                    )}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{agent.name}</h3>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      agent.type === "inbound"
                        ? "bg-success/10 text-success"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {agent.type}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            {/* Description */}
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
              {agent.description}
            </p>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span className="text-xs">Calls</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {agent.totalCalls.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Avg</span>
                </div>
                <p className="text-lg font-semibold font-mono text-foreground">
                  {agent.avgDuration}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-xs">Rate</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {agent.successRate}%
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                Last active: {agent.lastActive}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={agent.status === "active" ? "outline" : "default"}
                  size="icon"
                  className="h-8 w-8"
                >
                  {agent.status === "active" ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
