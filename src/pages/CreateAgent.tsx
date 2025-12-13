import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Settings2,
  Calendar,
  Database,
  Bot,
  Phone,
  Volume2,
  Clock,
  RefreshCw,
  Mic,
  Upload,
  Sparkles,
  PhoneCall,
  CalendarDays,
  Mail,
  Search,
  FileText,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "instructions", label: "Instructions", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "knowledge", label: "Knowledge Base", icon: Database },
];

const aiTools = [
  { id: "end_call", label: "End Call", icon: PhoneCall },
  { id: "calendar_update", label: "Google Calendar Update", icon: CalendarDays },
  { id: "calendar_view", label: "Google Calendar View", icon: Calendar },
  { id: "calendar_delete", label: "Google Calendar Delete", icon: CalendarDays },
  { id: "invoice", label: "Invoice Handling", icon: FileText },
  { id: "web_search", label: "Web Search", icon: Search },
  { id: "email", label: "Send Email", icon: Mail },
];

const voices = [
  { id: "alloy", name: "Alloy", gender: "Female", provider: "OpenAI", color: "bg-blue-500" },
  { id: "ash", name: "Ash", gender: "Male", provider: "OpenAI", color: "bg-orange-500" },
  { id: "ballad", name: "Ballad", gender: "Neutral", provider: "OpenAI", color: "bg-purple-500" },
  { id: "coral", name: "Coral", gender: "Female", provider: "OpenAI", color: "bg-pink-500" },
  { id: "echo", name: "Echo", gender: "Male", provider: "OpenAI", color: "bg-red-500" },
  { id: "sage", name: "Sage", gender: "Female", provider: "OpenAI", color: "bg-green-500" },
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

const quickInserts = [
  { id: "first_name", label: "First Name" },
  { id: "last_name", label: "Last Name" },
  { id: "phone", label: "Phone Number" },
  { id: "company", label: "Company" },
  { id: "date", label: "Current Date" },
  { id: "time", label: "Current Time" },
  { id: "datetime", label: "Date & Time" },
];

export default function CreateAgent() {
  const { type } = useParams<{ type: "inbound" | "outbound" }>();
  const [activeTab, setActiveTab] = useState("instructions");
  const [agentName, setAgentName] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [selectedPhone, setSelectedPhone] = useState("1");
  const [selectedDays, setSelectedDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [greeting, setGreeting] = useState(
    "Hello {{first_name}}, this is Sarah from {{custom_data.company}}. How are you today?"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    "You are calling {{first_name}} {{last_name}} from {{custom_data.company}} to discuss our new product offerings. Be professional but friendly, and always..."
  );
  const [analysisPrompt, setAnalysisPrompt] = useState(
    "Analyze this call transcript and provide a summary focusing on: key discussion points, client sentiment, outcomes, and required follow-up actions..."
  );
  const [maxRingTime, setMaxRingTime] = useState([60]);
  const [maxCallDuration, setMaxCallDuration] = useState([5]);
  const [maxRetries, setMaxRetries] = useState(3);
  const [concurrentCalls, setConcurrentCalls] = useState(3);
  const [retryDelay, setRetryDelay] = useState({ hours: 0, minutes: 5 });
  const [enableRecording, setEnableRecording] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const isInbound = type === "inbound";

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    );
  };

  const insertVariable = (variable: string) => {
    // In a real app, this would insert at cursor position
    setGreeting((prev) => prev + `{{${variable}}}`);
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Create {isInbound ? "Inbound" : "Outbound"} Agent
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure your AI agent for {isInbound ? "incoming" : "outgoing"} phone calls with custom instructions and settings
          </p>
        </div>
        <Link to="/agents">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
      </div>

      {/* Agent Name & Create Button */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Enter agent name..."
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="flex-1 text-lg"
          />
          <Button className="gap-2 px-6">
            <Plus className="h-4 w-4" />
            Create {isInbound ? "Inbound" : "Outbound"} Agent
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
        {activeTab === "instructions" && (
          <>
            {/* Greeting Message */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Greeting Message</h3>
                    <p className="text-sm text-muted-foreground">
                      The first thing your AI agent says when the call connects
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Quick Insert:</Label>
                    <div className="flex flex-wrap gap-2">
                      {quickInserts.map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(item.id)}
                          className="text-xs"
                        >
                          ○ {item.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click on a dynamic variable to insert it into your message. These will be replaced with actual data during calls.
                    </p>
                  </div>

                  <Textarea
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder="Enter greeting message..."
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="text-warning">ⓘ</span>
                    Keep it short, friendly, and specific.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Tools */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">AI Tools</h3>
                      <p className="text-sm text-muted-foreground">
                        Select tools the agent can use during calls
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {selectedTools.length} selected
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {aiTools.map((tool) => (
                      <Button
                        key={tool.id}
                        variant={selectedTools.includes(tool.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTool(tool.id)}
                        className="gap-2"
                      >
                        <tool.icon className="h-4 w-4" />
                        {tool.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                  <Bot className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Voice Agent Instructions</h3>
                      <p className="text-sm text-muted-foreground">
                        Define how your voice robot should behave and respond during calls
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Generate with AI
                    </Button>
                  </div>
                  
                  <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                    <p className="text-sm text-blue-400">
                      <span className="font-medium">Tip:</span> Test your instructions on the{" "}
                      <a href="#" className="underline">OpenAI Realtime Playground</a> before creating the campaign.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Quick Insert:</Label>
                    <div className="flex flex-wrap gap-2">
                      {quickInserts.map((item) => (
                        <Button
                          key={item.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                        >
                          ○ {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt..."
                    className="min-h-[150px]"
                  />
                </div>
              </div>
            </div>

            {/* Call Analysis */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Call Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Instructions for analyzing call transcripts and generating summaries
                    </p>
                  </div>

                  <Textarea
                    value={analysisPrompt}
                    onChange={(e) => setAnalysisPrompt(e.target.value)}
                    placeholder="Enter analysis instructions..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "settings" && (
          <>
            {/* Phone Number */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Caller Number</h3>
                      <p className="text-sm text-muted-foreground">
                        Select the phone number for {isInbound ? "receiving" : "outgoing"} calls
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">1 selected</span>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    Select one or more phone numbers for this {isInbound ? "inbound" : "outbound"} campaign.
                  </p>

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

                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Manage Phone Numbers
                  </Button>
                </div>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10">
                  <Volume2 className="h-5 w-5 text-pink-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Voice Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the voice for your AI agent
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {voices.map((voice) => (
                      <div
                        key={voice.id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedVoice === voice.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedVoice(voice.id)}
                      >
                        <div
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-full",
                            voice.color
                          )}
                        >
                          <Volume2 className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {voice.name}
                            {selectedVoice === voice.id && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {voice.gender} • {voice.provider}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          ▶ Preview
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Call Time Settings */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10">
                  <Clock className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 space-y-6">
                  <div>
                    <h3 className="font-semibold text-foreground">Call Time Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure timing and retry behavior
                    </p>
                  </div>

                  {/* Max Ring Time */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                          <Clock className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Max Ring Time</p>
                          <p className="text-xs text-muted-foreground">
                            Maximum time to let the phone ring before ending
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold">{maxRingTime[0]}s</span>
                    </div>
                    <div className="px-2">
                      <Slider
                        value={maxRingTime}
                        onValueChange={setMaxRingTime}
                        min={10}
                        max={60}
                        step={5}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>10s</span>
                        <span>60s</span>
                      </div>
                    </div>
                  </div>

                  {/* Max Call Duration */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                          <Phone className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Max Call Duration</p>
                          <p className="text-xs text-muted-foreground">
                            Maximum duration for each call before auto-ending
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-semibold">{maxCallDuration[0]}m</span>
                    </div>
                    <div className="px-2">
                      <Slider
                        value={maxCallDuration}
                        onValueChange={setMaxCallDuration}
                        min={1}
                        max={15}
                        step={1}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1 min</span>
                        <span>15 min</span>
                      </div>
                    </div>
                  </div>

                  {/* Retries & Concurrent */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                          <RefreshCw className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Max Retries</p>
                          <p className="text-xs text-muted-foreground">
                            Retry attempts for unanswered calls
                          </p>
                        </div>
                      </div>
                      <Input
                        type="number"
                        value={maxRetries}
                        onChange={(e) => setMaxRetries(Number(e.target.value))}
                        min={0}
                        max={10}
                        className="text-center"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                          <Phone className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Concurrent Calls</p>
                          <p className="text-xs text-muted-foreground">
                            Max parallel calls (1-3)
                          </p>
                        </div>
                      </div>
                      <Input
                        type="number"
                        value={concurrentCalls}
                        onChange={(e) => setConcurrentCalls(Number(e.target.value))}
                        min={1}
                        max={3}
                        className="text-center"
                      />
                    </div>
                  </div>

                  {/* Retry Delay */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                        <Clock className="h-4 w-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Retry Delay</p>
                        <p className="text-xs text-muted-foreground">
                          Wait time before retrying a failed call
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={retryDelay.hours}
                          onChange={(e) =>
                            setRetryDelay((prev) => ({
                              ...prev,
                              hours: Number(e.target.value),
                            }))
                          }
                          min={0}
                          className="text-center"
                        />
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Hours
                        </p>
                      </div>
                      <span className="text-muted-foreground">:</span>
                      <div className="flex-1">
                        <Input
                          type="number"
                          value={retryDelay.minutes}
                          onChange={(e) =>
                            setRetryDelay((prev) => ({
                              ...prev,
                              minutes: Number(e.target.value),
                            }))
                          }
                          min={0}
                          max={59}
                          className="text-center"
                        />
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Minutes
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <span className="text-xs bg-secondary px-3 py-1 rounded-full text-muted-foreground">
                        ⏱ Wait: {retryDelay.hours}h {retryDelay.minutes}min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recording & Transcription */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <Mic className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      Recording & Transcription
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Configure call recording and transcription settings
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-foreground">
                        Enable Call Recording & Transcription
                      </p>
                      <p className="text-sm text-muted-foreground">
                        When enabled, all calls will be recorded and transcribed automatically for analysis
                      </p>
                    </div>
                    <Switch
                      checked={enableRecording}
                      onCheckedChange={setEnableRecording}
                    />
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
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Campaign Schedule</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure when your AI agent can make {isInbound ? "receive" : "outgoing"} calls
                  </p>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Calling Hours */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                          <Clock className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Calling Hours</p>
                          <p className="text-xs text-muted-foreground">
                            Set the time window for automatic calls
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">Start Time</Label>
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm text-muted-foreground">End Time</Label>
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Call Days */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                          <CalendarDays className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Call Days</p>
                          <p className="text-xs text-muted-foreground">
                            Select which days automatic calls can be made
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {weekDays.map((day) => (
                          <button
                            key={day.id}
                            onClick={() => toggleDay(day.id)}
                            className={cn(
                              "p-3 rounded-lg text-center transition-all",
                              selectedDays.includes(day.id)
                                ? "bg-primary/10 border-primary text-primary border"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            )}
                          >
                            <p className="font-medium text-sm">{day.short}</p>
                            <p className="text-xs mt-0.5">
                              {selectedDays.includes(day.id) ? "Workday" : "Weekend"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <Globe className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Campaign Timezone</h3>
                    <p className="text-sm text-muted-foreground">
                      Select the timezone for scheduling calls
                    </p>
                  </div>

                  <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                      <Globe className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Europe/Tallinn (EET/EEST) - Estonia</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">
                    {isInbound ? "Inbound" : "Outbound"} Call Configuration Summary
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Overview of your campaign configuration
                  </p>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-foreground">Schedule</span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Hours: {startTime} - {endTime}</p>
                        <p>Timezone: Europe/Tallinn (...)</p>
                        <p>Days: {selectedDays.length > 0 ? "Configured" : "Not set"}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings2 className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-foreground">Call Logic</span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Max answer: {maxRingTime[0]}s</p>
                        <p>Max duration: {maxCallDuration[0]}m</p>
                        <p>Retries: {maxRetries}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Mic className="h-4 w-4 text-pink-500" />
                        <span className="font-medium text-foreground">Recording</span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Recording: {enableRecording ? "Enabled" : "Disabled"}</p>
                        <p>Transcription: {enableRecording ? "Enabled" : "Disabled"}</p>
                        <p>Quality: High</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "knowledge" && (
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Knowledge Base</h3>
                  <p className="text-sm text-muted-foreground">
                    Add documents that the AI voice agent can reference during calls
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Upload Documents</Label>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          Drag files here or click to browse
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Supports .txt, .doc, and .docx files up to 10MB each
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    ⓘ Knowledge Base Tips:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Add FAQs, product info, and company policies</li>
                    <li>• Keep information current and accurate</li>
                    <li>• Organize information logically</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
