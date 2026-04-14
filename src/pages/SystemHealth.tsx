import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Database, Phone, Bot, Server,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { orchestratorClient } from "@/services/orchestratorClient";
import { toast } from "sonner";
import { format } from "date-fns";

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown" | "not_configured";
  lastCheck: string | null;
  details: string;
  icon: React.ComponentType<{ className?: string }>;
  responseTime?: number;
}

export default function SystemHealth() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [orchestratorUrl, setOrchestratorUrl] = useState<string>("");
  const [providerRows, setProviderRows] = useState<any[]>([]);

  const checkHealth = async () => {
    setIsChecking(true);
    const now = new Date().toISOString();
    const results: ServiceStatus[] = [];

    // 1. Check Database
    const dbStart = performance.now();
    try {
      const { error: dbError } = await supabase.from("calls").select("id").limit(1);
      const dbTime = Math.round(performance.now() - dbStart);
      results.push({
        name: "Database",
        status: dbError ? "down" : "healthy",
        lastCheck: now,
        details: dbError ? dbError.message : `Connected (${dbTime}ms)`,
        icon: Database,
        responseTime: dbTime,
      });
    } catch {
      results.push({ name: "Database", status: "down", lastCheck: now, details: "Connection failed", icon: Database });
    }

    // 2. Check Auth
    const { data: { session } } = await supabase.auth.getSession();
    results.push({
      name: "Authentication",
      status: session ? "healthy" : "degraded",
      lastCheck: now,
      details: session ? `Authenticated as ${session.user.email}` : "No active session",
      icon: Activity,
    });

    // 3. Check Orchestrator + Twilio + OpenAI
    const orchestratorConfig = orchestratorClient.getConfig();
    setOrchestratorUrl(orchestratorConfig.baseUrl);

    if (!orchestratorConfig.isConfigured) {
      results.push({ name: "Orchestrator", status: "not_configured", lastCheck: now, details: "VITE_API_BASE_URL not set", icon: Server });
      results.push({ name: "Twilio", status: "not_configured", lastCheck: now, details: "Requires orchestrator", icon: Phone });
      results.push({ name: "OpenAI", status: "not_configured", lastCheck: now, details: "Requires orchestrator", icon: Bot });
    } else {
      const orchStart = performance.now();
      const healthResponse = await orchestratorClient.health();
      const orchTime = Math.round(performance.now() - orchStart);

      if (healthResponse.ok) {
        results.push({
          name: "Orchestrator",
          status: "healthy",
          lastCheck: now,
          details: `${orchestratorConfig.baseUrl} (${orchTime}ms)`,
          icon: Server,
          responseTime: orchTime,
        });

        const twilio = healthResponse.providers?.twilio;
        results.push({
          name: "Twilio",
          status: twilio?.configured ? "healthy" : "not_configured",
          lastCheck: now,
          details: twilio?.status || "Unknown",
          icon: Phone,
        });

        const openai = healthResponse.providers?.openai;
        results.push({
          name: "OpenAI",
          status: openai?.configured ? "healthy" : "not_configured",
          lastCheck: now,
          details: openai?.status || "Unknown",
          icon: Bot,
        });
      } else {
        results.push({ name: "Orchestrator", status: "down", lastCheck: now, details: `Cannot reach ${orchestratorConfig.baseUrl}`, icon: Server });
        results.push({ name: "Twilio", status: "unknown", lastCheck: now, details: "Orchestrator unreachable", icon: Phone });
        results.push({ name: "OpenAI", status: "unknown", lastCheck: now, details: "Orchestrator unreachable", icon: Bot });
      }
    }

    // 4. Read provider_status table for additional context
    const { data: providerData } = await supabase
      .from("provider_status")
      .select("*")
      .order("last_checked_at", { ascending: false });

    if (providerData) {
      setProviderRows(providerData);
    }

    // 5. Edge Functions check (hit health-check function)
    const efStart = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      const efTime = Math.round(performance.now() - efStart);
      results.push({
        name: "Edge Functions",
        status: error ? "down" : "healthy",
        lastCheck: now,
        details: error ? error.message : `Running (${efTime}ms)`,
        icon: Activity,
        responseTime: efTime,
      });
    } catch {
      results.push({ name: "Edge Functions", status: "down", lastCheck: now, details: "Unreachable", icon: Activity });
    }

    setServices(results);
    setLastFullCheck(new Date());
    setIsChecking(false);
    toast.success("Health check completed");
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getStatusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "healthy": return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "degraded": return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "down": return <XCircle className="h-5 w-5 text-destructive" />;
      case "not_configured": return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "healthy": return <Badge className="bg-success/20 text-success border-success/30">Healthy</Badge>;
      case "degraded": return <Badge className="bg-warning/20 text-warning border-warning/30">Degraded</Badge>;
      case "down": return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Down</Badge>;
      case "not_configured": return <Badge variant="outline">Not Configured</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const healthyCount = services.filter(s => s.status === "healthy").length;
  const degradedCount = services.filter(s => s.status === "degraded").length;
  const downCount = services.filter(s => s.status === "down").length;
  const notConfiguredCount = services.filter(s => s.status === "not_configured").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">System Health</h1>
            <p className="text-muted-foreground">Live platform connectivity and service status</p>
          </div>
        </div>
        <Button onClick={checkHealth} disabled={isChecking} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Run Checks'}
        </Button>
      </div>

      {!orchestratorUrl && (
        <Card className="border-warning/50 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">Orchestrator Not Configured</h4>
              <p className="text-sm text-muted-foreground">
                Set <code className="bg-muted px-1 rounded">VITE_API_BASE_URL</code> to your Railway orchestrator URL for call placement and voice features.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { count: healthyCount, label: "Healthy", icon: CheckCircle2, color: "success" },
          { count: degradedCount, label: "Degraded", icon: AlertTriangle, color: "warning" },
          { count: downCount, label: "Down", icon: XCircle, color: "destructive" },
          { count: notConfiguredCount, label: "Not Configured", icon: Clock, color: "muted" },
        ].map((item) => (
          <Card key={item.label} className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${item.color}/10`}>
                <item.icon className={`h-5 w-5 text-${item.color === "muted" ? "muted-foreground" : item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{item.count}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <Card key={service.name} className="glass-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50">
                  <service.icon className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{service.name}</h3>
                  <p className="text-sm text-muted-foreground truncate max-w-[250px]">{service.details}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(service.status)}
                {getStatusBadge(service.status)}
              </div>
            </div>
            {service.lastCheck && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last checked: {format(new Date(service.lastCheck), "MMM dd, HH:mm:ss")}
                {service.responseTime != null && ` • ${service.responseTime}ms`}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Provider Status from DB */}
      {providerRows.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Circuit Breaker States</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {providerRows.map((row: any) => (
              <Card key={row.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground capitalize">{row.provider} / {row.component}</h4>
                  <Badge variant="outline" className={
                    row.circuit === "closed" ? "border-success/30 text-success" :
                    row.circuit === "open" ? "border-destructive/30 text-destructive" :
                    "border-warning/30 text-warning"
                  }>
                    {row.circuit}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>State: <span className="capitalize">{row.state}</span></p>
                  <p>Success: {row.success_count} | Failures: {row.failure_count}</p>
                  {row.last_error && <p className="text-destructive truncate">Error: {row.last_error}</p>}
                  <p>Checked: {format(new Date(row.last_checked_at), "MMM dd, HH:mm")}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="glass-card p-4">
        <div className="flex items-start gap-3">
          <Server className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">Architecture</h4>
            <p className="text-sm text-muted-foreground">
              <strong>UI</strong> (this app) → <strong>Orchestrator</strong> (Railway) → <strong>Twilio/OpenAI</strong><br />
              UI reads call data from the database (source of truth). Orchestrator handles all Twilio and OpenAI Realtime operations.
            </p>
          </div>
        </div>
      </Card>

      {lastFullCheck && (
        <p className="text-center text-sm text-muted-foreground">
          Last full check: {format(lastFullCheck, "PPpp")}
        </p>
      )}
    </div>
  );
}
