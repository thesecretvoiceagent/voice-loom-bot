import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Megaphone,
  Settings2,
  Calendar,
  Users,
  Bot,
  Phone,
  Clock,
  RefreshCw,
  Upload,
  Play,
  FileText,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "basic", label: "Basic Info", icon: Megaphone },
  { id: "agent", label: "AI Agent", icon: Bot },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const agents = [
  { id: "1", name: "Sales Assistant", type: "outbound", status: "active" },
  { id: "2", name: "Support Agent", type: "inbound", status: "active" },
  { id: "3", name: "Reminder Bot", type: "outbound", status: "active" },
  { id: "4", name: "Collection Agent", type: "outbound", status: "inactive" },
];

const phoneNumbers = [
  { id: "1", label: "Mobile EST", number: "+37256011298" },
];

const weekDays = [
  { id: "mon", label: "Monday", short: "Mon" },
  { id: "tue", label: "Tuesday", short: "Tue" },
  { id: "wed", label: "Wednesday", short: "Wed" },
  { id: "thu", label: "Thursday", short: "Thu" },
  { id: "fri", label: "Friday", short: "Fri" },
  { id: "sat", label: "Saturday", short: "Sat" },
  { id: "sun", label: "Sunday", short: "Sun" },
];

const timezones = [
  { id: "europe-tallinn", label: "Europe/Tallinn (EET)", offset: "+02:00" },
  { id: "europe-london", label: "Europe/London (GMT)", offset: "+00:00" },
  { id: "europe-berlin", label: "Europe/Berlin (CET)", offset: "+01:00" },
  { id: "america-new-york", label: "America/New_York (EST)", offset: "-05:00" },
];

export default function CreateCampaign() {
  const [activeTab, setActiveTab] = useState("basic");
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("1");
  const [selectedDays, setSelectedDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("europe-tallinn");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState([3]);
  const [maxRetries, setMaxRetries] = useState([3]);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState([30]);
  const [enableRecording, setEnableRecording] = useState(true);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [enableVoicemailDetection, setEnableVoicemailDetection] = useState(true);

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    );
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Create Campaign</h1>
          <p className="mt-1 text-muted-foreground">
            Set up a new outbound calling campaign with AI voice agents
          </p>
        </div>
        <Link to="/campaigns">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>

      {/* Campaign Name & Create Button */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary flex-shrink-0">
            <Megaphone className="h-6 w-6 text-primary-foreground" />
          </div>
          <Input
            placeholder="Enter campaign name..."
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="flex-1 text-lg"
          />
          <Button className="gap-2 px-6">
            <Plus className="h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-xl p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "basic" && (
          <>
            {/* Campaign Description */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Campaign Description</h3>
                    <p className="text-sm text-muted-foreground">
                      Describe the purpose and goals of this campaign
                    </p>
                  </div>
                  <Textarea
                    value={campaignDescription}
                    onChange={(e) => setCampaignDescription(e.target.value)}
                    placeholder="E.g., Q4 sales outreach to promote new product line..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>

            {/* Campaign Dates */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Campaign Duration</h3>
                    <p className="text-sm text-muted-foreground">
                      Set the start and end dates for this campaign
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "agent" && (
          <>
            {/* Select AI Agent */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                  <Bot className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Select AI Voice Agent</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose the AI agent that will handle calls for this campaign
                      </p>
                    </div>
                    <Link to="/agents/create/outbound">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create New Agent
                      </Button>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    {agents.filter(a => a.type === "outbound").map((agent) => (
                      <div
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedAgent === agent.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedAgent(agent.id)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                          <Bot className="h-5 w-5 text-success" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {agent.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {agent.status === "active" ? "Ready to use" : "Inactive"}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-all",
                            selectedAgent === agent.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Phone Number */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Caller Number</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the phone number for outgoing calls
                    </p>
                  </div>

                  <div className="space-y-2">
                    {phoneNumbers.map((phone) => (
                      <div
                        key={phone.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedPhone === phone.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedPhone(phone.id)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{phone.label}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {phone.number}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-all",
                            selectedPhone === phone.id
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "schedule" && (
          <>
            {/* Calling Hours */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Calling Hours</h3>
                    <p className="text-sm text-muted-foreground">
                      Define when calls can be made
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Days */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Active Days</h3>
                    <p className="text-sm text-muted-foreground">
                      Select days when calls should be made
                    </p>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => (
                      <button
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={cn(
                          "py-3 px-2 rounded-lg text-sm font-medium transition-all",
                          selectedDays.includes(day.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                        )}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                  <Globe className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Timezone</h3>
                    <p className="text-sm text-muted-foreground">
                      Schedule times will be interpreted in this timezone
                    </p>
                  </div>

                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.id} value={tz.id}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "contacts" && (
          <>
            {/* Upload Contacts */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                  <Users className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Contact List</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload contacts to call in this campaign
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium text-foreground mb-1">
                      Drop your CSV file here
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      or click to browse files
                    </p>
                    <Button variant="outline" size="sm">
                      Select File
                    </Button>
                  </div>

                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                    <p className="text-sm text-primary font-medium mb-2">Required CSV Format:</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      phone_number, first_name, last_name, company, email, custom_data
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>Or use the API to add contacts programmatically.</p>
                    <Link to="/settings/api-docs" className="text-primary hover:underline">
                      View API Documentation →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "settings" && (
          <>
            {/* Concurrent Calls */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Concurrent Calls</h3>
                      <p className="text-sm text-muted-foreground">
                        Maximum number of simultaneous calls
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-primary">{maxConcurrentCalls[0]}</span>
                  </div>
                  <Slider
                    value={maxConcurrentCalls}
                    onValueChange={setMaxConcurrentCalls}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher values process contacts faster but may increase costs
                  </p>
                </div>
              </div>
            </div>

            {/* Retry Settings */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <RefreshCw className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Retry Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure automatic retry behavior for unanswered calls
                    </p>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Maximum Retries</Label>
                        <span className="font-medium text-foreground">{maxRetries[0]}</span>
                      </div>
                      <Slider
                        value={maxRetries}
                        onValueChange={setMaxRetries}
                        max={5}
                        min={0}
                        step={1}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Retry Delay (minutes)</Label>
                        <span className="font-medium text-foreground">{retryDelayMinutes[0]}</span>
                      </div>
                      <Slider
                        value={retryDelayMinutes}
                        onValueChange={setRetryDelayMinutes}
                        max={120}
                        min={5}
                        step={5}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording & Transcription */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <Settings2 className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="font-semibold text-foreground">Call Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure recording and transcription options
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div>
                        <p className="font-medium text-foreground">Call Recording</p>
                        <p className="text-sm text-muted-foreground">
                          Record all calls for review and compliance
                        </p>
                      </div>
                      <Switch
                        checked={enableRecording}
                        onCheckedChange={setEnableRecording}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div>
                        <p className="font-medium text-foreground">Transcription (STT)</p>
                        <p className="text-sm text-muted-foreground">
                          Generate text transcripts for all calls
                        </p>
                      </div>
                      <Switch
                        checked={enableTranscription}
                        onCheckedChange={setEnableTranscription}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div>
                        <p className="font-medium text-foreground">Voicemail Detection</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically detect and handle voicemail
                        </p>
                      </div>
                      <Switch
                        checked={enableVoicemailDetection}
                        onCheckedChange={setEnableVoicemailDetection}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Complete all sections before launching the campaign
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline">Save as Draft</Button>
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Create & Launch
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
