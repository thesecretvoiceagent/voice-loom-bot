import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Plus, Settings, Code, Copy, Check, Trash2, Pencil, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Widget {
  id: string;
  phoneNumber: string;
  agentName: string;
  active: boolean;
}

const existingWidgets: Widget[] = [
  {
    id: "45e0d969-5477-43d1-993c-7cb5f9bea17c",
    phoneNumber: "+37256011298",
    agentName: "BeyondCode AI Voice Agent",
    active: true,
  },
];

export default function WidgetsSettings() {
  const [activeTab, setActiveTab] = useState<"create" | "manage">("manage");
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(existingWidgets[0]);
  const [copied, setCopied] = useState(false);

  const [widgetConfig, setWidgetConfig] = useState({
    name: "",
    phoneNumber: "+37256011298",
    brandColor: "#3b82f6",
    position: "bottom-right",
    greeting: "Need help? Call us for instant support!",
    buttonText: "Call",
    feature1: "Available 24/7",
    feature2: "Instant connection",
    feature3: "No wait time",
  });

  const embedCode = selectedWidget ? `<script> (function() { var script = document.createElement('script');
script.src = 'https://api.beyondcode.ee/api/widget?id=${selectedWidget.id}'; script.setAttribute('data-ai-assistant-widget',
'true'); script.setAttribute('data-widget-id', '${selectedWidget.id}'); document.head.appendChild(script); })();
</script>` : "";

  const customizationCode = `<script> window.CallAgentWidget = { position: 'bottom-right',
autoOpen: false, delay: 3000, theme: 'custom' }; </script>`;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Call Widgets</h2>
          <p className="text-muted-foreground">Create and manage call widgets for website integration</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "manage")}>
        <TabsList className="bg-secondary/30 p-1 rounded-xl">
          <TabsTrigger 
            value="create" 
            className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Widget
          </TabsTrigger>
          <TabsTrigger 
            value="manage" 
            className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
          >
            <Settings className="h-4 w-4" />
            Manage Widgets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Create New Call Widget
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure your website call widget
              </p>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="widget-name">Widget Name</Label>
                    <Input
                      id="widget-name"
                      placeholder="E.g., Customer Support Widget"
                      value={widgetConfig.name}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={widgetConfig.phoneNumber}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, phoneNumber: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Brand Color</Label>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-10 w-10 rounded-lg border border-border/50 cursor-pointer"
                        style={{ backgroundColor: widgetConfig.brandColor }}
                      />
                      <Input
                        value={widgetConfig.brandColor}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, brandColor: e.target.value })}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={widgetConfig.position}
                      onValueChange={(v) => setWidgetConfig({ ...widgetConfig, position: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="greeting">Greeting Message</Label>
                  <Input
                    id="greeting"
                    value={widgetConfig.greeting}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, greeting: e.target.value })}
                  />
                </div>

                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Create Widget
                </Button>
              </div>
            </Card>

            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Widget Preview</h3>
              
              <div className="relative h-[300px] rounded-xl border border-border/50 bg-secondary/20 flex items-end justify-end p-4">
                <div 
                  className="rounded-2xl shadow-xl p-4 min-w-[200px]"
                  style={{ backgroundColor: widgetConfig.brandColor }}
                >
                  <div className="flex items-center gap-3 text-white">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{widgetConfig.phoneNumber}</p>
                      <p className="text-xs opacity-80">AI Assistant</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Your Widgets ({existingWidgets.length})
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Manage existing widgets
              </p>

              <div className="space-y-4">
                {existingWidgets.map((widget) => (
                  <div
                    key={widget.id}
                    onClick={() => setSelectedWidget(widget)}
                    className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                      selectedWidget?.id === widget.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/50"
                    }`}
                  >
                    {widget.active && (
                      <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-success" />
                    )}
                    <p className="font-mono text-sm text-foreground">{widget.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground mt-1">{widget.agentName}</p>

                    <div className="flex items-center gap-2 mt-4">
                      <Badge variant={selectedWidget?.id === widget.id ? "default" : "secondary"}>
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </Badge>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="glass-card rounded-xl border-border/50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Integration Guide</h3>
                  <Badge variant="outline" className="text-primary border-primary/30 mt-1">
                    {selectedWidget?.agentName || "None"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-foreground text-sm mb-2">1. Add to your website</h4>
                  <div className="relative rounded-lg bg-secondary/50 border border-border/50 p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyCode(embedCode)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap pr-8">
                      {embedCode}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-foreground text-sm mb-2">2. Customize (optional)</h4>
                  <div className="relative rounded-lg bg-secondary/50 border border-border/50 p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyCode(customizationCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap pr-8">
                      {customizationCode}
                    </pre>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
