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
import { toast } from "sonner";
import { format } from "date-fns";

interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  lastCheck: string | null;
  details: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function SystemHealth() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Database", status: "unknown", lastCheck: null, details: "Checking...", icon: Database },
    { name: "Authentication", status: "unknown", lastCheck: null, details: "Checking...", icon: Activity },
    { name: "Twilio", status: "unknown", lastCheck: null, details: "Not configured", icon: Phone },
    { name: "OpenAI API", status: "unknown", lastCheck: null, details: "Not configured", icon: Bot },
    { name: "Gemini API", status: "unknown", lastCheck: null, details: "Not configured", icon: Sparkles },
    { name: "Vercel Runtime", status: "unknown", lastCheck: null, details: "Checking...", icon: Globe },
    { name: "Railway Workers", status: "unknown", lastCheck: null, details: "Not configured", icon: Server },
  ]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

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

      // Check health-check edge function for external services
      const { data: healthData, error: healthError } = await supabase.functions.invoke('health-check');
      
      if (healthError) {
        updateService("OpenAI API", "unknown", now, "Health check failed");
        updateService("Gemini API", "unknown", now, "Health check failed");
        updateService("Twilio", "unknown", now, "Health check failed");
      } else if (healthData) {
        if (healthData.openai) {
          updateService("OpenAI API", healthData.openai.status, now, healthData.openai.message);
        }
        if (healthData.gemini) {
          updateService("Gemini API", healthData.gemini.status, now, healthData.gemini.message);
        }
        if (healthData.twilio) {
          updateService("Twilio", healthData.twilio.status, now, healthData.twilio.message);
        }
      }

      // Vercel runtime - if we're here, it's working
      updateService("Vercel Runtime", "healthy", now, "App responding");
      
      // Railway workers - check via edge function
      updateService("Railway Workers", "unknown", now, "Not configured");

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
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "healthy": return <Badge className="bg-success/20 text-success border-success/30">Healthy</Badge>;
      case "degraded": return <Badge className="bg-warning/20 text-warning border-warning/30">Degraded</Badge>;
      case "down": return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Down</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const healthyCount = services.filter(s => s.status === "healthy").length;
  const degradedCount = services.filter(s => s.status === "degraded").length;
  const downCount = services.filter(s => s.status === "down").length;

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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {lastFullCheck ? format(lastFullCheck, "HH:mm:ss") : "--:--:--"}
              </p>
              <p className="text-sm text-muted-foreground">Last Check</p>
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
                  <p className="text-sm text-muted-foreground">{service.details}</p>
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

      {/* Info */}
      <Card className="glass-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground">Service Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Services marked as "Not configured" require API keys to be set in Settings → API Keys. 
              Once configured, health checks will validate connectivity to external services.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
