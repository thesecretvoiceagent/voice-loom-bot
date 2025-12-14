import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Webhook, RefreshCw, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";

export default function ToolsSettings() {
  const [showSecret, setShowSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const { settings, loading, generateWebhookSecret, updateWebhookUrl } = useOrganizationSettings();

  const copySecret = () => {
    if (settings?.webhook_secret) {
      navigator.clipboard.writeText(settings.webhook_secret);
      toast.success("Webhook secret copied to clipboard");
    }
  };

  const handleRegenerateSecret = async () => {
    setRegenerating(true);
    await generateWebhookSecret();
    setRegenerating(false);
  };

  const handleSaveWebhook = async () => {
    setSaving(true);
    await updateWebhookUrl(webhookUrl || settings?.webhook_url || "");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
          <Wrench className="h-6 w-6 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Tools</h2>
          <p className="text-muted-foreground">Configure webhooks and integrations</p>
        </div>
      </div>

      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Webhook className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Webhook Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Configure webhook endpoints to receive real-time call events
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://your-server.com/webhooks/calls"
                className="font-mono text-sm"
                defaultValue={settings?.webhook_url || ""}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                We'll send POST requests to this URL when call events occur.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret (HMAC)</Label>
              {settings?.webhook_secret ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={showSecret ? settings.webhook_secret : "•".repeat(32)}
                    readOnly
                    className="font-mono text-sm bg-secondary/30"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={copySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  No webhook secret generated yet. Click "Regenerate Secret" to create one.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Use this secret to verify webhook signatures (HMAC-SHA256).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={handleRegenerateSecret}
                disabled={regenerating}
              >
                {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {settings?.webhook_secret ? "Regenerate Secret" : "Generate Secret"}
              </Button>
              <Button onClick={handleSaveWebhook} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Webhook Settings
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Available Webhook Events</h3>
          <div className="space-y-3">
            {[
              {
                event: "call.completed",
                description: "Sent when a call ends with full transcript and AI summary",
              },
              {
                event: "call.started",
                description: "Sent when a call is initiated",
              },
              {
                event: "call.failed",
                description: "Sent when a call fails to connect",
              },
            ].map((item) => (
              <div
                key={item.event}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/20 p-4"
              >
                <code className="rounded bg-primary/10 px-2 py-1 text-xs font-mono text-primary">
                  {item.event}
                </code>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
