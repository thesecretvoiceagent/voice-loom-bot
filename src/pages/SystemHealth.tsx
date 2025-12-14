import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Database, 
  Phone, 
  Bot, 
  Sparkles, 
  Globe, 
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock
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
}

export default function SystemHealth() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Database", status: "unknown", lastCheck: null, details: "Checking...", icon: Database },
    { name: "Authentication", status: "unknown", lastCheck: null, details: "Checking...", icon: Activity },
    { name: "Orchestrator", status: "unknown", lastCheck: null, details: "Checking...", icon: Server },
    { name: "Twilio", status: "unknown", lastCheck: null, details: "Not configured", icon: Phone },
    { name: "OpenAI API", status: "unknown", lastCheck: null, details: "Not configured", icon: Bot },
    { name: "Supabase", status: "unknown", lastCheck: null, details: "Checking...", icon: Database },
  ]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);
  const [orchestratorUrl, setOrchestratorUrl] = useState<string>("");

  const checkHealth = async () => {
    setIsChecking(true);
    const now = new Date().toISOString();
    
    try {
      // Check Database connectivity
      const { data: dbCheck, error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
      
      updateService("Database", dbError ? "down" : "healthy", now, dbError?.message || "Connected");

      // Check Auth
      const { data: { session } } = await supabase.auth.getSession();
      updateService("Authentication", session ? "healthy" : "degraded", now, session ? "Authenticated" : "No active session");

      // Check Supabase
      updateService("Supabase", "healthy", now, "Connected");

      // Check EXTERNAL ORCHESTRATOR
      const orchestratorConfig = orchestratorClient.getConfig();
      setOrchestratorUrl(orchestratorConfig.baseUrl);
      
      if (!orchestratorConfig.isConfigured) {
        updateService("Orchestrator", "not_configured", now, "VITE_API_BASE_URL not set");
        updateService("Twilio", "not_configured", now, "Orchestrator not configured");
        updateService("OpenAI API", "not_configured", now, "Orchestrator not configured");
      } else {
        // Call orchestrator health endpoint
        const healthResponse = await orchestratorClient.health();
        
        if (healthResponse.ok) {
          updateService("Orchestrator", "healthy", now, `${orchestratorConfig.baseUrl}`);
          
          // Get provider status from orchestrator
          if (healthResponse.providers?.twilio) {
            updateService("Twilio", 
              healthResponse.providers.twilio.configured ? "healthy" : "not_configured", 
              now, 
              healthResponse.providers.twilio.status
            );
          }
          if (healthResponse.providers?.openai) {
            updateService("OpenAI API", 
              healthResponse.providers.openai.configured ? "healthy" : "not_configured", 
              now, 
              healthResponse.providers.openai.status
            );
          }
        } else {
          updateService("Orchestrator", "down", now, `Cannot reach ${orchestratorConfig.baseUrl}`);
          updateService("Twilio", "unknown", now, "Orchestrator unreachable");
          updateService("OpenAI API", "unknown", now, "Orchestrator unreachable");
        }
      }

      setLastFullCheck(new Date());
      toast.success("Health check completed");
    } catch (error) {
      console.error("Health check error:", error);
      toast.error("Health check failed");
    } finally {
      setIsChecking(false);
    }
  };

  const updateService = (name: string, status: ServiceStatus["status"], lastCheck: string, details: string) => {
    setServices(prev => prev.map(s => 
      s.name === name ? { ...s, status, lastCheck, details } : s
    ));
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">System Health</h1>
            <p className="text-muted-foreground">Monitor platform connectivity and service status</p>
          </div>
        </div>
        <Button 
          onClick={checkHealth} 
          disabled={isChecking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      {/* Orchestrator Config Warning */}
      {!orchestratorUrl && (
        <Card className="border-warning/50 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <h4 className="font-medium text-foreground">Orchestrator Not Configured</h4>
              <p className="text-sm text-muted-foreground">
                Set <code className="bg-muted px-1 rounded">VITE_API_BASE_URL</code> to your Railway orchestrator URL.
                This is required for call placement and voice features.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{healthyCount}</p>
              <p className="text-sm text-muted-foreground">Healthy</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{degradedCount}</p>
              <p className="text-sm text-muted-foreground">Degraded</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{downCount}</p>
              <p className="text-sm text-muted-foreground">Down</p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{notConfiguredCount}</p>
              <p className="text-sm text-muted-foreground">Not Configured</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Services Grid */}
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
                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">{service.details}</p>
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
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Architecture Info */}
      <Card className="glass-card p-4">
        <div className="flex items-start gap-3">
          <Server className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">Architecture</h4>
            <p className="text-sm text-muted-foreground">
              <strong>UI</strong> (this app) → <strong>Orchestrator</strong> (Railway) → <strong>Twilio/OpenAI</strong>
              <br />
              UI reads call data from <strong>Supabase</strong> (source of truth). 
              Orchestrator handles all Twilio and OpenAI Realtime operations.
            </p>
          </div>
        </div>
      </Card>

      {/* Last Check */}
      {lastFullCheck && (
        <p className="text-center text-sm text-muted-foreground">
          Last full check: {format(lastFullCheck, "PPpp")}
        </p>
      )}
    </div>
  );
}
