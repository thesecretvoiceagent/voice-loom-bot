import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Activity, Database, Phone, Bot, Server,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Save, Settings2, Loader2, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { orchestratorClient } from "@/services/orchestratorClient";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [providerRows, setProviderRows] = useState<any[]>([]);

  // Configuration form
  const [orchUrl, setOrchUrl] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load saved orchestrator URL from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("organization_settings")
        .select("orchestrator_url")
        .eq("user_id", user.id)
        .maybeSingle();
      const savedUrl = (data as any)?.orchestrator_url || "";
      setOrchUrl(savedUrl);
      if (savedUrl) {
        orchestratorClient.setRuntimeUrl(savedUrl);
      }
      setConfigLoaded(true);
    })();
  }, [user]);

  // Run health checks after config loads
  useEffect(() => {
    if (configLoaded) checkHealth();
  }, [configLoaded]);

  const saveConfig = async () => {
    if (!user) return;
    setSavingConfig(true);
    try {
      const { data: existing } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("organization_settings")
          .update({ orchestrator_url: orchUrl } as any)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_settings")
          .insert({ user_id: user.id, orchestrator_url: orchUrl } as any);
        if (error) throw error;
      }

      orchestratorClient.setRuntimeUrl(orchUrl);
      toast.success("Configuration saved");
      checkHealth();
    } catch (err) {
      toast.error("Failed to save configuration");
      console.error(err);
    } finally {
      setSavingConfig(false);
    }
  };

  const checkHealth = async () => {
    setIsChecking(true);
    const now = new Date().toISOString();
    const results: ServiceStatus[] = [];

    // 1. Database
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

    // 2. Auth
    const { data: { session } } = await supabase.auth.getSession();
    results.push({
      name: "Authentication",
      status: session ? "healthy" : "degraded",
      lastCheck: now,
      details: session ? `Authenticated as ${session.user.email}` : "No active session",
      icon: Activity,
    });

    // 3. Orchestrator + Twilio + OpenAI
    const orchestratorConfig = orchestratorClient.getConfig();

    if (!orchestratorConfig.isConfigured) {
      results.push({ name: "Orchestrator", status: "not_configured", lastCheck: now, details: "URL not set — configure below", icon: Server });
      results.push({ name: "Twilio", status: "not_configured", lastCheck: now, details: "Requires orchestrator", icon: Phone });
      results.push({ name: "OpenAI API", status: "not_configured", lastCheck: now, details: "Requires orchestrator", icon: Bot });
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
          name: "OpenAI API",
          status: openai?.configured ? "healthy" : "not_configured",
          lastCheck: now,
          details: openai?.status || "Unknown",
          icon: Bot,
        });
      } else {
        results.push({ name: "Orchestrator", status: "down", lastCheck: now, details: `Cannot reach ${orchestratorConfig.baseUrl}`, icon: Server });
        results.push({ name: "Twilio", status: "unknown", lastCheck: now, details: "Orchestrator unreachable", icon: Phone });
        results.push({ name: "OpenAI API", status: "unknown", lastCheck: now, details: "Orchestrator unreachable", icon: Bot });
      }
    }

    // 4. Edge Functions
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

    // 5. Provider status from DB
    const { data: providerData } = await supabase
      .from("provider_status")
      .select("*")
      .order("last_checked_at", { ascending: false });
    if (providerData) setProviderRows(providerData);

    // Supabase (always healthy if we got this far)
    results.push({
      name: "Supabase",
      status: "healthy",
      lastCheck: now,
      details: "Connected",
      icon: Database,
    });

    setServices(results);
    setLastFullCheck(new Date());
    setIsChecking(false);
    toast.success("Health check completed");
  };

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

      {/* Configuration Panel */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Service Configuration</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orch-url" className="text-sm font-medium">
              Orchestrator URL <span className="text-muted-foreground">(Railway deployment)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="orch-url"
                placeholder="https://your-orchestrator.up.railway.app"
                value={orchUrl}
                onChange={(e) => setOrchUrl(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={saveConfig} disabled={savingConfig} className="gap-2">
                {savingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your Railway orchestrator URL. This connects the UI to Twilio and OpenAI for call placement and voice features.
            </p>
          </div>
        </div>
      </Card>

      {/* Status Summary */}
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

      {/* Service Cards */}
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

      {/* Circuit Breaker States */}
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

      {/* Architecture */}
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
