import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
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
  Loader2,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { AgentRow } from "@/hooks/useAgents";

const tabs = [
  { id: "instructions", label: "Instructions", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "knowledge", label: "Knowledge Base", icon: Database },
];

const aiTools = [
  { id: "end_call", label: "End Call", icon: PhoneCall },
  { id: "lookup_vehicle", label: "CRM: Lookup Vehicle", icon: Database },
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

const timezones = [
  { value: "Europe/Tallinn", label: "Europe/Tallinn (EET/EEST)" },
  { value: "Europe/Helsinki", label: "Europe/Helsinki (EET/EEST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET/CEST)" },
  { value: "Europe/Rome", label: "Europe/Rome (CET/CEST)" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET/CEST)" },
  { value: "Europe/Stockholm", label: "Europe/Stockholm (CET/CEST)" },
  { value: "Europe/Riga", label: "Europe/Riga (EET/EEST)" },
  { value: "Europe/Vilnius", label: "Europe/Vilnius (EET/EEST)" },
  { value: "Europe/Warsaw", label: "Europe/Warsaw (CET/CEST)" },
  { value: "Europe/Moscow", label: "Europe/Moscow (MSK)" },
  { value: "Europe/Kiev", label: "Europe/Kyiv (EET/EEST)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (TRT)" },
  { value: "US/Eastern", label: "US/Eastern (EST/EDT)" },
  { value: "US/Central", label: "US/Central (CST/CDT)" },
  { value: "US/Mountain", label: "US/Mountain (MST/MDT)" },
  { value: "US/Pacific", label: "US/Pacific (PST/PDT)" },
  { value: "America/New_York", label: "America/New York (EST/EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST/CDT)" },
  { value: "America/Denver", label: "America/Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST/PDT)" },
  { value: "America/Toronto", label: "America/Toronto (EST/EDT)" },
  { value: "America/Sao_Paulo", label: "America/São Paulo (BRT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZST/NZDT)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
  { value: "UTC", label: "UTC" },
];

export default function CreateAgent() {
  const { type } = useParams<{ type: "inbound" | "outbound" }>();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("instructions");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  // Form state
  const [agentName, setAgentName] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [selectedPhone, setSelectedPhone] = useState("1");
  const [selectedDays, setSelectedDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [greeting, setGreeting] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [maxRingTime, setMaxRingTime] = useState([60]);
  const [maxCallDuration, setMaxCallDuration] = useState([5]);
  const [maxRetries, setMaxRetries] = useState(3);
  const [concurrentCalls, setConcurrentCalls] = useState(3);
  const [retryDelay, setRetryDelay] = useState({ hours: 0, minutes: 5 });
  const [enableRecording, setEnableRecording] = useState(true);
  const [temperature, setTemperature] = useState([0.6]);
  const [uninterruptibleGreeting, setUninterruptibleGreeting] = useState(true);
  const [antiBargein, setAntiBargein] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("Europe/Tallinn");
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; name: string; content: string }>>([]);
  const [knowledgeText, setKnowledgeText] = useState("");
  type SmsMessage = { id: string; name: string; content: string; trigger: "during" | "after" };
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);

  const isInbound = type === "inbound";

  // Load existing agent for editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", editId)
        .single();

      if (error || !data) {
        toast.error("Agent not found");
        navigate("/agents");
        return;
      }

      const agent = data as unknown as AgentRow;
      setAgentName(agent.name);
      setGreeting(agent.greeting || "");
      setSystemPrompt(agent.system_prompt || "");
      setAnalysisPrompt(agent.analysis_prompt || "");
      setSelectedVoice(agent.voice || "alloy");
      setSelectedTools(agent.tools || []);
      if (agent.settings) {
        setMaxRingTime([agent.settings.max_ring_time || 60]);
        setMaxCallDuration([agent.settings.max_call_duration || 5]);
        setMaxRetries(agent.settings.max_retries ?? 3);
        setConcurrentCalls(agent.settings.concurrent_calls ?? 3);
        setRetryDelay({
          hours: agent.settings.retry_delay_hours ?? 0,
          minutes: agent.settings.retry_delay_minutes ?? 5,
        });
        setEnableRecording(agent.settings.enable_recording ?? true);
        setTemperature([(agent.settings as any).temperature ?? 0.6]);
        setUninterruptibleGreeting((agent.settings as any).uninterruptible_greeting ?? true);
        setAntiBargein((agent.settings as any).anti_barge_in ?? false);
        const rawSettings = agent.settings as any;
        if (Array.isArray(rawSettings.sms_messages)) {
          setSmsMessages(rawSettings.sms_messages);
        } else if (rawSettings.sms_template) {
          // Backward-compat: migrate single template + flags into the new array.
          const migrated: SmsMessage[] = [];
          if (rawSettings.sms_during_call) {
            migrated.push({
              id: crypto.randomUUID(),
              name: "Default (during call)",
              content: rawSettings.sms_template,
              trigger: "during",
            });
          }
          if (rawSettings.sms_after_call) {
            migrated.push({
              id: crypto.randomUUID(),
              name: "Default (after call)",
              content: rawSettings.sms_template,
              trigger: "after",
            });
          }
          if (migrated.length === 0) {
            migrated.push({
              id: crypto.randomUUID(),
              name: "Default",
              content: rawSettings.sms_template,
              trigger: "during",
            });
          }
          setSmsMessages(migrated);
        }
      }
      if (agent.schedule) {
        setStartTime(agent.schedule.start_time || "09:00");
        setEndTime(agent.schedule.end_time || "17:00");
        setSelectedDays(agent.schedule.days || []);
        setTimezone(agent.schedule.timezone || "Europe/Tallinn");
      }
      if (agent.knowledge_base && Array.isArray(agent.knowledge_base)) {
        setKnowledgeItems(agent.knowledge_base as any[] || []);
      }
      setLoadingEdit(false);
    })();
  }, [editId, navigate]);

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  };

  const insertVariable = (variable: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter((prev) => prev + `{{${variable}}}`);
  };

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast.error("Please enter an agent name");
      return;
    }
    if (!user?.id) {
      toast.error("You must be logged in");
      return;
    }

    setSaving(true);

    const settingsPayload = {
      max_ring_time: maxRingTime[0],
      max_call_duration: maxCallDuration[0],
      max_retries: maxRetries,
      concurrent_calls: concurrentCalls,
      retry_delay_hours: retryDelay.hours,
      retry_delay_minutes: retryDelay.minutes,
      enable_recording: enableRecording,
      temperature: temperature[0],
      uninterruptible_greeting: uninterruptibleGreeting,
      anti_barge_in: antiBargein,
      sms_messages: smsMessages.map((m, idx) => ({
        id: m.id,
        name: (m.name || `SMS ${idx + 1}`).trim(),
        content: m.content || "",
        trigger: m.trigger === "after" ? "after" : "during",
        order: idx,
      })),
    console.log("[CreateAgent] Saving settings:", settingsPayload);

    const agentData = {
      name: agentName,
      type: type || "outbound",
      greeting,
      system_prompt: systemPrompt,
      analysis_prompt: analysisPrompt,
      voice: selectedVoice,
      phone_number: phoneNumbers.find((p) => p.id === selectedPhone)?.number || "",
      tools: selectedTools,
      settings: settingsPayload,
      schedule: {
        start_time: startTime,
        end_time: endTime,
        days: selectedDays,
        timezone,
      },
      knowledge_base: knowledgeItems,
    };

    try {
      if (editId) {
        const { data, error } = await supabase
          .from("agents")
          .update(agentData as any)
          .eq("id", editId)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Update affected 0 rows — you may not have permission to edit this agent.");
        }
        toast.success(`Agent updated · SMS: ${smsDuringCall ? "during" : "off"}/${smsAfterCall ? "after" : "off"}`);
      } else {
        const { error } = await supabase
          .from("agents")
          .insert({ ...agentData, user_id: user.id } as any);
        if (error) throw error;
        toast.success("Agent created");
      }
      navigate("/agents");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {editId ? "Edit" : "Create"} {isInbound ? "Inbound" : "Outbound"} Agent
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure your AI agent for {isInbound ? "incoming" : "outgoing"} phone calls
          </p>
        </div>
        <Link to="/agents">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
      </div>

      {/* Agent Name & Save */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Enter agent name..."
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="flex-1 text-lg"
          />
          <Button className="gap-2 px-6" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {editId ? "Update" : "Create"} Agent
              </>
            )}
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
                        <Button key={item.id} variant="outline" size="sm" onClick={() => insertVariable(item.id, setGreeting)} className="text-xs">
                          ○ {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} placeholder="Hello {{first_name}}, this is..." className="min-h-[100px]" />
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-foreground">Uninterruptible Greeting</p>
                      <p className="text-sm text-muted-foreground">Initial message plays fully without being cut off by caller</p>
                    </div>
                    <Switch checked={uninterruptibleGreeting} onCheckedChange={setUninterruptibleGreeting} />
                  </div>
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
                      <p className="text-sm text-muted-foreground">Select tools the agent can use during calls</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedTools.length} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiTools.map((tool) => (
                      <Button key={tool.id} variant={selectedTools.includes(tool.id) ? "default" : "outline"} size="sm" onClick={() => toggleTool(tool.id)} className="gap-2">
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
                  <div>
                    <h3 className="font-semibold text-foreground">Voice Agent Instructions</h3>
                    <p className="text-sm text-muted-foreground">Define how your voice robot should behave and respond during calls</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Quick Insert:</Label>
                    <div className="flex flex-wrap gap-2">
                      {quickInserts.map((item) => (
                        <Button key={item.id} variant="outline" size="sm" onClick={() => insertVariable(item.id, setSystemPrompt)} className="text-xs">
                          ○ {item.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are a helpful AI voice assistant..." className="min-h-[150px]" />
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-foreground">Anti Barge-in</p>
                      <p className="text-sm text-muted-foreground">Mute caller's microphone while the AI is speaking to prevent interruptions</p>
                    </div>
                    <Switch checked={antiBargein} onCheckedChange={setAntiBargein} />
                  </div>
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
                    <p className="text-sm text-muted-foreground">Instructions for analyzing call transcripts</p>
                  </div>
                  <Textarea value={analysisPrompt} onChange={(e) => setAnalysisPrompt(e.target.value)} placeholder="Analyze this call transcript..." className="min-h-[100px]" />

                  {/* SMS Follow-up */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div>
                      <h4 className="font-semibold text-foreground">SMS Follow-up</h4>
                      <p className="text-sm text-muted-foreground">
                        Send an SMS to the caller. Use {"{{caller_name}}"}, {"{{caller_reg_no}}"}, {"{{first_name}}"} and other variables.
                      </p>
                    </div>
                    <Textarea
                      value={smsTemplate}
                      onChange={(e) => setSmsTemplate(e.target.value)}
                      placeholder="Tere {{caller_name}}, täname kõne eest! Lisainfo: ..."
                      className="min-h-[80px]"
                      maxLength={1600}
                    />
                    <div className="text-xs text-muted-foreground text-right">{smsTemplate.length}/1600</div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground text-sm">Send SMS during call</p>
                        <p className="text-xs text-muted-foreground">AI can trigger send_sms tool mid-conversation when relevant</p>
                      </div>
                      <Switch checked={smsDuringCall} onCheckedChange={setSmsDuringCall} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="font-medium text-foreground text-sm">Send SMS after call ends</p>
                        <p className="text-xs text-muted-foreground">Automatically send the template once the call completes</p>
                      </div>
                      <Switch checked={smsAfterCall} onCheckedChange={setSmsAfterCall} />
                    </div>
                  </div>
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
                  <div>
                    <h3 className="font-semibold text-foreground">Caller Number</h3>
                    <p className="text-sm text-muted-foreground">Select the phone number for {isInbound ? "receiving" : "outgoing"} calls</p>
                  </div>
                  <div className="space-y-2">
                    {phoneNumbers.map((phone) => (
                      <div
                        key={phone.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedPhone === phone.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedPhone(phone.id)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{phone.label}</p>
                          <p className="text-sm text-muted-foreground font-mono">{phone.number}</p>
                        </div>
                        <div className={cn("h-5 w-5 rounded-full border-2 transition-all", selectedPhone === phone.id ? "border-primary bg-primary" : "border-muted-foreground")} />
                      </div>
                    ))}
                  </div>
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
                    <p className="text-sm text-muted-foreground">Select the voice for your AI agent</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {voices.map((voice) => (
                      <div
                        key={voice.id}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedVoice === voice.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedVoice(voice.id)}
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", voice.color)}>
                          <Volume2 className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground flex items-center gap-2">
                            {voice.name}
                            {selectedVoice === voice.id && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{voice.gender} • {voice.provider}</p>
                        </div>
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
                    <p className="text-sm text-muted-foreground">Configure timing and retry behavior</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">Max Ring Time</p>
                      <span className="text-lg font-semibold">{maxRingTime[0]}s</span>
                    </div>
                    <Slider value={maxRingTime} onValueChange={setMaxRingTime} min={10} max={60} step={5} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">Max Call Duration</p>
                      <span className="text-lg font-semibold">{maxCallDuration[0]}m</span>
                    </div>
                    <Slider value={maxCallDuration} onValueChange={setMaxCallDuration} min={1} max={15} step={1} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Max Retries</p>
                      <Input type="number" value={maxRetries} onChange={(e) => setMaxRetries(Number(e.target.value))} min={0} max={10} className="text-center" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">Concurrent Calls</p>
                      <Input type="number" value={concurrentCalls} onChange={(e) => setConcurrentCalls(Number(e.target.value))} min={1} max={3} className="text-center" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="font-medium text-foreground">Retry Delay</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input type="number" value={retryDelay.hours} onChange={(e) => setRetryDelay((p) => ({ ...p, hours: Number(e.target.value) }))} min={0} className="text-center" />
                        <p className="text-xs text-center text-muted-foreground mt-1">Hours</p>
                      </div>
                      <span className="text-muted-foreground">:</span>
                      <div className="flex-1">
                        <Input type="number" value={retryDelay.minutes} onChange={(e) => setRetryDelay((p) => ({ ...p, minutes: Number(e.target.value) }))} min={0} max={59} className="text-center" />
                        <p className="text-xs text-center text-muted-foreground mt-1">Minutes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Temperature */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">AI Temperature</h3>
                    <p className="text-sm text-muted-foreground">Controls how creative vs. focused the AI is. Lower = strict script follower, higher = more creative.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Focused</p>
                      <span className="text-lg font-semibold">{temperature[0].toFixed(1)}</span>
                      <p className="text-sm text-muted-foreground">Creative</p>
                    </div>
                    <Slider value={temperature} onValueChange={setTemperature} min={0.1} max={1.0} step={0.1} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recording */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                  <Mic className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 space-y-4">
                  <h3 className="font-semibold text-foreground">Recording & Transcription</h3>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-foreground">Enable Call Recording & Transcription</p>
                      <p className="text-sm text-muted-foreground">All calls will be recorded and transcribed automatically</p>
                    </div>
                    <Switch checked={enableRecording} onCheckedChange={setEnableRecording} />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "schedule" && (
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground">Campaign Schedule</h3>
                  <p className="text-sm text-muted-foreground">When your AI agent can make/receive calls</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="font-medium text-foreground">Calling Hours</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Start</Label>
                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">End</Label>
                        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="font-medium text-foreground">Call Days</p>
                    <div className="grid grid-cols-4 gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.id}
                          onClick={() => toggleDay(day.id)}
                          className={cn(
                            "p-3 rounded-lg text-center transition-all",
                            selectedDays.includes(day.id) ? "bg-primary/10 border-primary text-primary border" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          )}
                        >
                          <p className="font-medium text-sm">{day.short}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-orange-500" />
                    <p className="font-medium text-foreground">Timezone</p>
                  </div>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-border bg-secondary/30 text-foreground"
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
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
                  <p className="text-sm text-muted-foreground">Add information the AI can reference during calls</p>
                </div>

                {/* Add knowledge item */}
                <div className="space-y-3">
                  <Input
                    placeholder="Topic name (e.g. Pricing, FAQ, Product Info)..."
                    value={knowledgeText}
                    onChange={(e) => setKnowledgeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && knowledgeText.trim()) {
                        setKnowledgeItems((prev) => [
                          ...prev,
                          { id: crypto.randomUUID(), name: knowledgeText.trim(), content: "" },
                        ]);
                        setKnowledgeText("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (knowledgeText.trim()) {
                        setKnowledgeItems((prev) => [
                          ...prev,
                          { id: crypto.randomUUID(), name: knowledgeText.trim(), content: "" },
                        ]);
                        setKnowledgeText("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Topic
                  </Button>
                </div>

                {/* Knowledge items list */}
                {knowledgeItems.length > 0 && (
                  <div className="space-y-4">
                    {knowledgeItems.map((item) => (
                      <div key={item.id} className="border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground text-sm">{item.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setKnowledgeItems((prev) => prev.filter((k) => k.id !== item.id))}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        <Textarea
                          value={item.content}
                          onChange={(e) =>
                            setKnowledgeItems((prev) =>
                              prev.map((k) => (k.id === item.id ? { ...k, content: e.target.value } : k))
                            )
                          }
                          placeholder={`Enter information about ${item.name}...`}
                          className="min-h-[100px]"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {knowledgeItems.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Database className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">No knowledge items yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Add topics with content the AI can reference during calls</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
