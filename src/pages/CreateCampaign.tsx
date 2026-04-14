import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Plus, Megaphone, Settings2, Calendar, Users,
  Bot, Clock, RefreshCw, Upload, Play, FileText, Globe, Zap, Loader2, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAgents, type AgentRow } from "@/hooks/useAgents";

const tabs = [
  { id: "basic", label: "Basic Info", icon: Megaphone },
  { id: "agent", label: "AI Agent", icon: Bot },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "settings", label: "Settings", icon: Settings2 },
];

const weekDays = [
  { id: "mon", short: "Mon" }, { id: "tue", short: "Tue" },
  { id: "wed", short: "Wed" }, { id: "thu", short: "Thu" },
  { id: "fri", short: "Fri" }, { id: "sat", short: "Sat" },
  { id: "sun", short: "Sun" },
];

export default function CreateCampaign() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { agents, loading: agentsLoading } = useAgents();

  const [activeTab, setActiveTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editId);

  // Form state
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedDays, setSelectedDays] = useState(["mon", "tue", "wed", "thu", "fri"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxConcurrentCalls, setMaxConcurrentCalls] = useState([3]);
  const [maxRetries, setMaxRetries] = useState([3]);
  const [retryDelayMinutes, setRetryDelayMinutes] = useState([30]);
  const [enableRecording, setEnableRecording] = useState(true);
  const [enableTranscription, setEnableTranscription] = useState(true);
  const [enableVoicemailDetection, setEnableVoicemailDetection] = useState(true);

  // Load existing campaign for editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", editId)
        .single();
      if (error || !data) {
        toast.error("Campaign not found");
        navigate("/campaigns");
        return;
      }
      setCampaignName(data.name || "");
      setCampaignDescription(data.description || "");
      setSelectedAgent(data.agent_id || "");
      if (data.start_date) setStartDate(data.start_date);
      if (data.end_date) setEndDate(data.end_date);
      setLoadingEdit(false);
    })();
  }, [editId, navigate]);

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((id) => id !== dayId) : [...prev, dayId]
    );
  };

  const handleSave = async (launch = false) => {
    if (!campaignName.trim()) { toast.error("Enter a campaign name"); return; }
    if (!user?.id) { toast.error("You must be logged in"); return; }

    setSaving(true);
    const campaignData = {
      name: campaignName,
      description: campaignDescription,
      agent_id: selectedAgent || null,
      status: launch ? "active" : "scheduled",
      start_date: startDate || null,
      end_date: endDate || null,
    };

    try {
      if (editId) {
        const { error } = await supabase.from("campaigns").update(campaignData as any).eq("id", editId);
        if (error) throw error;
        toast.success("Campaign updated");
      } else {
        const { error } = await supabase.from("campaigns").insert({ ...campaignData, user_id: user.id } as any);
        if (error) throw error;
        toast.success(launch ? "Campaign created & launched" : "Campaign created");
      }
      navigate("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const outboundAgents = agents.filter((a) => a.type === "outbound");

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
          <h1 className="text-3xl font-bold text-foreground">{editId ? "Edit" : "Create"} Campaign</h1>
          <p className="mt-1 text-muted-foreground">Set up an outbound calling campaign with AI voice agents</p>
        </div>
        <Link to="/campaigns">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>

      {/* Campaign Name & Save */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary flex-shrink-0">
            <Megaphone className="h-6 w-6 text-primary-foreground" />
          </div>
          <Input placeholder="Enter campaign name..." value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="flex-1 text-lg" />
          <Button variant="outline" className="gap-2" onClick={() => handleSave(false)} disabled={saving}>
            <Save className="h-4 w-4" />
            {editId ? "Update" : "Save Draft"}
          </Button>
          <Button className="gap-2" onClick={() => handleSave(true)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {editId ? "Update & Launch" : "Create & Launch"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-xl p-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "basic" && (
          <>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Campaign Description</h3>
                    <p className="text-sm text-muted-foreground">Describe the purpose and goals</p>
                  </div>
                  <Textarea value={campaignDescription} onChange={(e) => setCampaignDescription(e.target.value)} placeholder="E.g., Q4 sales outreach to promote new product line..." className="min-h-[100px]" />
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Campaign Duration</h3>
                    <p className="text-sm text-muted-foreground">Set start and end dates</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "agent" && (
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <Bot className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Select AI Voice Agent</h3>
                    <p className="text-sm text-muted-foreground">Choose the agent for this campaign</p>
                  </div>
                  <Link to="/agents/create/outbound">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Agent
                    </Button>
                  </Link>
                </div>

                {agentsLoading ? (
                  <div className="py-8 text-center text-muted-foreground">Loading agents...</div>
                ) : outboundAgents.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No outbound agents found. Create one first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outboundAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                          selectedAgent === agent.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedAgent(agent.id)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                          <Bot className="h-5 w-5 text-success" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{agent.name}</p>
                            <Badge variant="outline" className="text-xs">{agent.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{agent.is_active ? "Active" : "Inactive"}</p>
                        </div>
                        <div className={cn("h-5 w-5 rounded-full border-2 transition-all", selectedAgent === agent.id ? "border-primary bg-primary" : "border-muted-foreground")} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Calling Hours</h3>
                    <p className="text-sm text-muted-foreground">Define when calls can be made</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                    <div className="space-y-2"><Label>End Time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Active Days</h3>
                    <p className="text-sm text-muted-foreground">Select days when calls should be made</p>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {weekDays.map((day) => (
                      <button key={day.id} onClick={() => toggleDay(day.id)} className={cn(
                        "py-3 px-2 rounded-lg text-sm font-medium transition-all",
                        selectedDays.includes(day.id) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                      )}>
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/30">
                <Globe className="h-5 w-5 text-warning" />
                <p className="font-medium text-foreground">Europe/Tallinn (EET/EEST)</p>
              </div>
            </div>
          </>
        )}

        {activeTab === "contacts" && (
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground">Contact List</h3>
                  <p className="text-sm text-muted-foreground">Upload contacts to call in this campaign</p>
                </div>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium text-foreground mb-1">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
                  <Button variant="outline" size="sm">Select File</Button>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <p className="text-sm text-primary font-medium mb-2">Required CSV Format:</p>
                  <p className="text-sm text-muted-foreground font-mono">phone_number, first_name, last_name, company, email, custom_data</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Or use the API to add contacts programmatically.</p>
                  <Link to="/settings/api-docs" className="text-primary hover:underline">View API Documentation →</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <>
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">Concurrent Calls</h3>
                      <p className="text-sm text-muted-foreground">Max simultaneous calls</p>
                    </div>
                    <span className="text-lg font-semibold text-primary">{maxConcurrentCalls[0]}</span>
                  </div>
                  <Slider value={maxConcurrentCalls} onValueChange={setMaxConcurrentCalls} max={10} min={1} step={1} />
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
                  <RefreshCw className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="font-semibold text-foreground">Retry Settings</h3>
                    <p className="text-sm text-muted-foreground">Automatic retry for unanswered calls</p>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between"><Label>Max Retries</Label><span className="font-medium text-foreground">{maxRetries[0]}</span></div>
                      <Slider value={maxRetries} onValueChange={setMaxRetries} max={5} min={0} step={1} />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between"><Label>Retry Delay (min)</Label><span className="font-medium text-foreground">{retryDelayMinutes[0]}</span></div>
                      <Slider value={retryDelayMinutes} onValueChange={setRetryDelayMinutes} max={120} min={5} step={5} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <Settings2 className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 space-y-6">
                  <h3 className="font-semibold text-foreground">Call Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div><p className="font-medium text-foreground">Call Recording</p><p className="text-sm text-muted-foreground">Record all calls</p></div>
                      <Switch checked={enableRecording} onCheckedChange={setEnableRecording} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div><p className="font-medium text-foreground">Transcription (STT)</p><p className="text-sm text-muted-foreground">Generate text transcripts</p></div>
                      <Switch checked={enableTranscription} onCheckedChange={setEnableTranscription} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-4">
                      <div><p className="font-medium text-foreground">Voicemail Detection</p><p className="text-sm text-muted-foreground">Auto-detect voicemail</p></div>
                      <Switch checked={enableVoicemailDetection} onCheckedChange={setEnableVoicemailDetection} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
