import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Plus, Settings, Code, Copy, Check, Trash2, Pencil } from "lucide-react";
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

export default function Widgets() {
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
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Call Widgets</h1>
        <p className="mt-1 text-muted-foreground">
          Create and manage call widgets for website integration
        </p>
      </div>

      {/* Tabs */}
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
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Configuration Form */}
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Create New Call Widget for Website Integration
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configure your website call widget so clients can easily connect with you
              </p>

              <div className="space-y-6">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="button-text">Button Text</Label>
                    <Input
                      id="button-text"
                      value={widgetConfig.buttonText}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, buttonText: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feature1">Feature 1</Label>
                    <Input
                      id="feature1"
                      value={widgetConfig.feature1}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, feature1: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="feature2">Feature 2</Label>
                    <Input
                      id="feature2"
                      value={widgetConfig.feature2}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, feature2: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feature3">Feature 3</Label>
                    <Input
                      id="feature3"
                      value={widgetConfig.feature3}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, feature3: e.target.value })}
                    />
                  </div>
                </div>

                <Button className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Create Widget
                </Button>
              </div>
            </Card>

            {/* Widget Preview */}
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-6">Widget Preview</h3>
              
              <div className="relative h-[400px] rounded-xl border border-border/50 bg-secondary/20 flex items-end justify-end p-4">
                {/* Widget Preview */}
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
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Widgets List */}
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Your Widgets ({existingWidgets.length})
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage existing widgets and their settings
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
                    
                    <div className="mt-4 h-32 rounded-lg border border-border/30 bg-secondary/20 flex items-end justify-end p-3">
                      <div className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground">
                        <Phone className="h-4 w-4" />
                        <span className="font-mono text-sm">{widget.phoneNumber}</span>
                        <span className="text-xs opacity-80">{widget.agentName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Badge variant={selectedWidget?.id === widget.id ? "default" : "secondary"}>
                        <Check className="h-3 w-3 mr-1" />
                        Widget Selected
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

            {/* Integration Guide */}
            <Card className="glass-card rounded-xl border-border/50 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Integration Guide</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Selected widget:</span>
                    <Badge variant="outline" className="text-primary border-primary/30">
                      {selectedWidget?.agentName || "None"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      1
                    </div>
                    <h4 className="font-medium text-foreground">Add widget to your website</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Copy and paste the following code into your website's {"<head>"} section:
                  </p>
                  <div className="relative rounded-lg bg-secondary/50 border border-border/50 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyCode(embedCode)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {embedCode}
                    </pre>
                  </div>
                </div>

                {/* Step 2 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      2
                    </div>
                    <h4 className="font-medium text-foreground">Customize settings (optional)</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    You can customize the widget behavior with additional attributes:
                  </p>
                  <div className="relative rounded-lg bg-secondary/50 border border-border/50 p-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyCode(customizationCode)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {customizationCode}
                    </pre>
                  </div>
                </div>

                {/* Step 3 */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      3
                    </div>
                    <h4 className="font-medium text-foreground">Test integration</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Visit your website and verify that the widget appears correctly and all functions work as expected.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
