import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Settings2,
  Key,
  Bell,
  Shield,
  Database,
  Phone,
  Globe,
  Save,
} from "lucide-react";

export default function Settings() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Platform configuration and preferences
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {[
              { icon: Settings2, label: "General", active: true },
              { icon: Key, label: "API Keys" },
              { icon: Phone, label: "Telephony" },
              { icon: Bell, label: "Notifications" },
              { icon: Shield, label: "Security" },
              { icon: Database, label: "Data & Storage" },
            ].map((item) => (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  item.active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* General Settings */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              General Settings
            </h2>
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <Input id="company" defaultValue="Fontakt OÜ" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" defaultValue="Europe/Tallinn (EET)" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="callback">Default Callback URL</Label>
                <Input
                  id="callback"
                  defaultValue="https://api.fontakt.ee/webhooks/voice"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* API Configuration */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              API Configuration
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="openai">OpenAI API Key</Label>
                <Input
                  id="openai"
                  type="password"
                  defaultValue="sk-••••••••••••••••••••••••"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Used for AI voice agent conversations
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                <Input
                  id="twilio-sid"
                  defaultValue="AC••••••••••••••••••••••••"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twilio-token">Twilio Auth Token</Label>
                <Input
                  id="twilio-token"
                  type="password"
                  defaultValue="••••••••••••••••••••••••"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* Telephony Settings */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              Telephony Settings
            </h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Call Recording</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically record all calls for review
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Transcription (STT)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Generate transcripts for all calls
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Voicemail Detection
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect and handle voicemail
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label htmlFor="caller-id">Default Caller ID</Label>
                <Input
                  id="caller-id"
                  defaultValue="+372 6123 4567"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button className="gap-2">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
