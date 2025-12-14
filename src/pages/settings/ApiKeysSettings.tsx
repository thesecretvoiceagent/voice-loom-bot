import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Copy, Eye, EyeOff, Trash2, Clock, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { format } from "date-fns";

export default function ApiKeysSettings() {
  const [showKey, setShowKey] = useState(false);
  const { settings, loading, generateApiKey, deleteApiKey } = useOrganizationSettings();
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const copyKey = () => {
    if (settings?.api_key) {
      navigator.clipboard.writeText(settings.api_key);
      toast.success("API key copied to clipboard");
    }
  };

  const handleGenerateKey = async () => {
    setGenerating(true);
    await generateApiKey();
    setGenerating(false);
  };

  const handleDeleteKey = async () => {
    setDeleting(true);
    await deleteApiKey();
    setDeleting(false);
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
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
          <Key className="h-6 w-6 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">API Keys</h2>
          <p className="text-muted-foreground">Manage your organization API keys</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        For developers: View{" "}
        <Link to="/settings/api-docs" className="text-primary hover:underline">
          API documentation
        </Link>{" "}
        for integration and usage guide.
      </p>

      <Card className="glass-card rounded-xl border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Key className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Primary API Key</h3>
              <p className="text-sm text-muted-foreground">
                This is your organization's primary API key for campaign request authentication
              </p>
            </div>
          </div>

          {settings?.api_key ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Primary API Key
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={showKey ? settings.api_key : "•".repeat(64)}
                    readOnly
                    className="font-mono text-sm bg-secondary/30"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={copyKey}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This key is used for API request authentication to your organization's campaigns and resources.
                </p>
              </div>

              <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Key Information</span>
                </div>
                <p className="text-sm text-foreground mt-2">
                  Created: {settings.api_key_created_at 
                    ? format(new Date(settings.api_key_created_at), "MMM dd, yyyy, hh:mm a")
                    : "Unknown"}
                </p>
              </div>

              <Button 
                variant="outline" 
                className="gap-2 text-destructive hover:text-destructive"
                onClick={handleDeleteKey}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete Key
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No API key has been generated yet.</p>
              <Button onClick={handleGenerateKey} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate API Key
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
