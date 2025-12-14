import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Settings2, 
  RefreshCw, 
  Phone, 
  MessageSquare, 
  Bot, 
  Sparkles,
  Mic,
  Activity,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { featureFlagService, FeatureFlag } from "@/services/featureFlagService";
import { useAuth } from "@/contexts/AuthContext";

const FLAG_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "calls.outbound.enabled": Phone,
  "sms.enabled": MessageSquare,
  "ai.enabled": Bot,
  "ai.openai.enabled": Bot,
  "ai.gemini.enabled": Sparkles,
  "ai.gemini.voice.enabled": Mic,
  "healthchecks.enabled": Activity,
};

const FLAG_LABELS: Record<string, string> = {
  "calls.outbound.enabled": "Outbound Calls",
  "sms.enabled": "SMS Notifications",
  "ai.enabled": "AI Features (Master)",
  "ai.provider.preferred": "Preferred AI Provider",
  "ai.openai.enabled": "OpenAI Provider",
  "ai.gemini.enabled": "Gemini Provider",
  "ai.gemini.voice.enabled": "Gemini Voice",
  "healthchecks.enabled": "Health Checks",
};

export default function FeatureFlags() {
  const { isAdmin } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [preferredProvider, setPreferredProvider] = useState<string>("gemini");

  const fetchFlags = async () => {
    setLoading(true);
    const data = await featureFlagService.getAll();
    setFlags(data);
    
    const prefFlag = data.find(f => f.key === "ai.provider.preferred");
    if (prefFlag?.value) {
      setPreferredProvider(prefFlag.value);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }

    setSaving(key);
    const success = await featureFlagService.setFlag(key, !currentEnabled);
    
    if (success) {
      toast.success(`${FLAG_LABELS[key] || key} ${!currentEnabled ? "enabled" : "disabled"}`);
      await fetchFlags();
    } else {
      toast.error("Failed to update flag");
    }
    
    setSaving(null);
  };

  const handleProviderChange = async () => {
    if (!isAdmin) {
      toast.error("Admin access required");
      return;
    }

    setSaving("ai.provider.preferred");
    const success = await featureFlagService.setFlag(
      "ai.provider.preferred",
      true,
      preferredProvider
    );
    
    if (success) {
      toast.success(`Preferred provider set to ${preferredProvider}`);
    } else {
      toast.error("Failed to update preferred provider");
    }
    
    setSaving(null);
  };

  const Icon = Settings2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-beyondcode shadow-neon">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Feature Flags</h1>
            <p className="text-muted-foreground">Control platform features and kill switches</p>
          </div>
        </div>
        <Button onClick={fetchFlags} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {!isAdmin && (
        <Card className="glass-card p-4 border-warning/30 bg-warning/5">
          <p className="text-sm text-warning">
            View-only mode. Admin access required to modify feature flags.
          </p>
        </Card>
      )}

      {/* Preferred Provider */}
      <Card className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Preferred AI Provider</h3>
              <p className="text-sm text-muted-foreground">Primary provider for AI completions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={preferredProvider}
              onChange={(e) => setPreferredProvider(e.target.value)}
              disabled={!isAdmin}
              className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm"
            >
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <Button 
              size="sm" 
              onClick={handleProviderChange}
              disabled={!isAdmin || saving === "ai.provider.preferred"}
            >
              {saving === "ai.provider.preferred" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Flags Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {flags
          .filter(f => f.key !== "ai.provider.preferred")
          .map((flag) => {
            const FlagIcon = FLAG_ICONS[flag.key] || Settings2;
            return (
              <Card key={flag.key} className="glass-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50">
                      <FlagIcon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {FLAG_LABELS[flag.key] || flag.key}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">{flag.key}</p>
                      {flag.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{flag.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {saving === flag.key && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleToggle(flag.key, flag.enabled)}
                      disabled={!isAdmin || saving === flag.key}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant={flag.enabled ? "default" : "secondary"}>
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <span>Updated: {format(new Date(flag.updated_at), "MMM dd, HH:mm")}</span>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
