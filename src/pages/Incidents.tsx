import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  RefreshCw, 
  Info,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { incidentService, IncidentSeverity } from "@/services/incidentService";
import type { Json } from "@/integrations/supabase/types";

interface IncidentDisplay {
  id: string;
  severity: IncidentSeverity;
  source: string;
  message: string;
  meta: Json;
  created_at: string;
}

export default function Incidents() {
  const [incidents, setIncidents] = useState<IncidentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IncidentSeverity | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ info: 0, warn: 0, critical: 0 });

  const fetchIncidents = async () => {
    setLoading(true);
    const [data, statsData] = await Promise.all([
      incidentService.getAll(200),
      incidentService.getStats(),
    ]);
    setIncidents(data);
    setStats(statsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const getSeverityIcon = (severity: IncidentSeverity) => {
    switch (severity) {
      case "info": return <Info className="h-4 w-4 text-blue-400" />;
      case "warn": return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "critical": return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case "info": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Info</Badge>;
      case "warn": return <Badge className="bg-warning/20 text-warning border-warning/30">Warning</Badge>;
      case "critical": return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critical</Badge>;
    }
  };

  const filteredIncidents = filter === "all" 
    ? incidents 
    : incidents.filter(i => i.severity === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <AlertCircle className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Incidents</h1>
            <p className="text-muted-foreground">System incidents and alerts log</p>
          </div>
        </div>
        <Button onClick={fetchIncidents} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`glass-card p-4 cursor-pointer transition-all ${filter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50">
              <AlertCircle className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.info + stats.warn + stats.critical}</p>
              <p className="text-sm text-muted-foreground">All (24h)</p>
            </div>
          </div>
        </Card>
        <Card 
          className={`glass-card p-4 cursor-pointer transition-all ${filter === "info" ? "ring-2 ring-blue-400" : ""}`}
          onClick={() => setFilter("info")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Info className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.info}</p>
              <p className="text-sm text-muted-foreground">Info</p>
            </div>
          </div>
        </Card>
        <Card 
          className={`glass-card p-4 cursor-pointer transition-all ${filter === "warn" ? "ring-2 ring-warning" : ""}`}
          onClick={() => setFilter("warn")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.warn}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </Card>
        <Card 
          className={`glass-card p-4 cursor-pointer transition-all ${filter === "critical" ? "ring-2 ring-destructive" : ""}`}
          onClick={() => setFilter("critical")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.critical}</p>
              <p className="text-sm text-muted-foreground">Critical</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="glass-card p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">Loading incidents...</p>
          </Card>
        ) : filteredIncidents.length === 0 ? (
          <Card className="glass-card p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">No incidents found</p>
          </Card>
        ) : (
          filteredIncidents.map((incident) => (
            <Card 
              key={incident.id} 
              className="glass-card p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
              onClick={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {expandedId === incident.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {getSeverityIcon(incident.severity)}
                  <div>
                    <p className="font-medium text-foreground">{incident.message}</p>
                    <p className="text-sm text-muted-foreground">Source: {incident.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(incident.severity)}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(incident.created_at), "MMM dd, HH:mm:ss")}
                  </span>
                </div>
              </div>
              
              {expandedId === incident.id && Object.keys(incident.meta).length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Metadata</p>
                  <pre className="text-xs text-foreground font-mono overflow-x-auto">
                    {JSON.stringify(incident.meta, null, 2)}
                  </pre>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
