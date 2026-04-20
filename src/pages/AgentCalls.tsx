import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, User as UserIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Download,
  Volume2,
  FileText,
  PhoneOutgoing,
  PhoneIncoming,
  Phone,
  Clock,
  Calendar,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalls, type CallRow } from "@/hooks/useCalls";
import { useAgents } from "@/hooks/useAgents";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getProxiedRecordingUrl } from "@/lib/recording";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatDateParts(dateStr: string | null): { date: string; time: string } | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return { date, time };
  } catch {
    return null;
  }
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return "";
  } catch {
    return "";
  }
}

export default function AgentCalls() {
  const { id } = useParams();
  const { calls, loading, refetch } = useCalls({ agent_id: id, limit: 200 });
  const { agents } = useAgents();
  const agent = agents.find((a) => a.id === id);

  const [filter, setFilter] = useState("all");
  const [transcriptModal, setTranscriptModal] = useState<CallRow | null>(null);
  const [summaryModal, setSummaryModal] = useState<CallRow | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const handleSyncRecordings = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-recording-backfill", {
        body: { agent_id: id, max_pages: 10 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const updated = data?.updated ?? 0;
      const scanned = data?.scanned ?? 0;
      const unmatched = data?.unmatched ?? 0;
      if (updated > 0) {
        toast.success(`Synced ${updated} recording${updated === 1 ? "" : "s"} from Twilio`, {
          description: `Scanned ${scanned} • ${unmatched} unmatched`,
        });
        refetch();
      } else {
        toast.info("No new recordings to sync", {
          description: `Scanned ${scanned} • ${unmatched} unmatched`,
        });
      }
    } catch (err) {
      toast.error("Failed to sync recordings", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  const filteredCalls = filter === "all"
    ? calls
    : calls.filter((c) => c.status === filter);

  const handleDelete = async (callId: string) => {
    if (!confirm("Delete this call log?")) return;
    setDeletingIds((prev) => new Set(prev).add(callId));
    try {
      const { error } = await supabase.from("calls").delete().eq("id", callId);
      if (error) throw error;
      toast.success("Call log deleted");
      refetch();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
    }
  };

  const agentName = agent?.name || "Agent";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/agents"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Voice Agents
          </Link>
          <h1 className="text-3xl font-bold text-foreground">
            Call Logs: {agentName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            <span className="text-sm">
              {loading ? "Loading..." : `${filteredCalls.length} call${filteredCalls.length !== 1 ? "s" : ""}`}
            </span>
          </p>
        </div>
        <Button className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="no-answer">No Answer</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">Direction</TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Call Time
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Duration
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Volume2 className="h-4 w-4" />
                  Recording
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">Summary</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredCalls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No calls recorded yet
                </TableCell>
              </TableRow>
            ) : (
              filteredCalls.map((call) => (
                <TableRow key={call.id} className="border-border hover:bg-secondary/30">
                  <TableCell>
                    <div className="space-y-0.5 text-sm">
                      <p className="font-mono">{call.to_number}</p>
                      {call.from_number && (
                        <p className="text-muted-foreground text-xs font-mono">
                          From: {call.from_number}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
                        call.direction === "outbound"
                          ? "bg-primary/10 text-primary"
                          : "bg-success/10 text-success"
                      )}
                    >
                      {call.direction === "outbound" ? (
                        <PhoneOutgoing className="h-3 w-3" />
                      ) : (
                        <PhoneIncoming className="h-3 w-3" />
                      )}
                      {call.direction === "outbound" ? "Outbound" : "Inbound"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const start = formatDateParts(call.started_at || call.created_at);
                      const end = formatDateParts(call.ended_at);
                      const rel = formatRelative(call.started_at || call.created_at);
                      if (!start) return <span className="text-muted-foreground">—</span>;
                      return (
                        <div className="text-sm leading-tight">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-medium text-foreground">{start.time}</span>
                            <span className="text-xs text-muted-foreground">{start.date}</span>
                          </div>
                          {end ? (
                            <p className="text-xs text-muted-foreground">ended {end.time}</p>
                          ) : rel ? (
                            <p className="text-xs text-muted-foreground">{rel}</p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {call.status === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                      {["failed", "busy", "no-answer", "canceled"].includes(call.status) && <XCircle className="h-4 w-4 text-destructive" />}
                      {["initiated", "ringing", "in-progress", "queued", "pending"].includes(call.status) && <Clock className="h-4 w-4 text-primary animate-pulse" />}
                      <span className={cn(
                        "text-xs font-medium capitalize",
                        call.status === "completed" && "text-success",
                        ["failed", "busy", "no-answer", "canceled"].includes(call.status) && "text-destructive",
                      )}>
                        {call.status.replace(/-/g, " ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(call.duration_seconds)}
                  </TableCell>
                  <TableCell>
                    {call.recording_url ? (
                      playingId === call.id ? (
                        <div className="flex items-center gap-2 min-w-[220px]">
                          <audio
                            src={getProxiedRecordingUrl(call.recording_url)}
                            controls
                            autoPlay
                            className="h-8 w-full max-w-[240px]"
                            onEnded={() => setPlayingId(null)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => setPlayingId(null)}
                            title="Close player"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-8"
                          onClick={() => setPlayingId(call.id)}
                          title="Play recording"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          Play
                        </Button>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {call.summary ? (
                      <button
                        type="button"
                        onClick={() => setSummaryModal(call)}
                        className="text-left text-sm text-muted-foreground line-clamp-2 max-w-[240px] hover:text-foreground transition-colors cursor-pointer underline-offset-2 hover:underline whitespace-pre-line"
                        title="Click to view full summary"
                      >
                        {call.summary.replace(/\n+/g, " · ")}
                      </button>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {call.transcript && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setTranscriptModal(call)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Transcript
                        </Button>
                      )}
                      {call.summary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSummaryModal(call)}
                          title="AI Summary"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(call.id)}
                        disabled={deletingIds.has(call.id)}
                        title="Delete"
                      >
                        {deletingIds.has(call.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>



      {/* Transcript Modal */}
      <Dialog open={!!transcriptModal} onOpenChange={() => setTranscriptModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Transcript
            </DialogTitle>
            <DialogDescription>
              {transcriptModal?.to_number} • {formatDuration(transcriptModal?.duration_seconds ?? null)} • {formatTime(transcriptModal?.started_at || transcriptModal?.created_at || null)}
            </DialogDescription>
          </DialogHeader>
          {transcriptModal?.transcript && (() => {
            const lines = transcriptModal.transcript.split("\n").filter((l: string) => l.trim());
            const turns = lines.map((line: string) => {
              const agentMatch = line.match(/^\[?(AI|Agent|Bot|Assistant)\]?:\s*(.+)/i);
              if (agentMatch) return { speaker: "agent" as const, text: agentMatch[2] };
              const userMatch = line.match(/^\[?(User|Customer|Caller|Human)\]?:\s*(.+)/i);
              if (userMatch) return { speaker: "user" as const, text: userMatch[2] };
              const systemMatch = line.match(/^\[?System\]?:\s*(.+)/i);
              if (systemMatch) return { speaker: "system" as const, text: systemMatch[1] };
              return { speaker: "user" as const, text: line };
            });
            return (
              <div className="flex-1 overflow-auto space-y-3 py-2">
                {turns.map((turn: { speaker: string; text: string }, i: number) => (
                  <div key={i} className={`flex gap-3 ${turn.speaker === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      turn.speaker === "agent" ? "bg-primary/10" : turn.speaker === "system" ? "bg-muted" : "bg-secondary"
                    )}>
                      {turn.speaker === "agent" ? <Bot className="h-3.5 w-3.5 text-primary" /> :
                       turn.speaker === "system" ? <Clock className="h-3.5 w-3.5 text-muted-foreground" /> :
                       <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className={cn(
                      "flex-1 rounded-xl p-3",
                      turn.speaker === "agent" ? "bg-primary/5 border border-primary/20" :
                      turn.speaker === "system" ? "bg-muted/50 border border-border/50 italic" :
                      "bg-secondary/50 border border-border/50"
                    )}>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {turn.speaker === "agent" ? "AI Agent" : turn.speaker === "system" ? "System" : "Customer"}
                      </p>
                      <p className="text-sm text-foreground">{turn.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* AI Summary Modal */}
      <Dialog open={!!summaryModal} onOpenChange={() => setSummaryModal(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              AI Call Summary
            </DialogTitle>
            <DialogDescription>Post-call analysis</DialogDescription>
          </DialogHeader>
          {summaryModal?.summary && (
            <div className="flex-1 overflow-auto pr-1 space-y-3 text-sm text-foreground leading-relaxed">
              {summaryModal.summary
                .replace(/\r\n/g, "\n")
                .split(/\n{2,}/)
                .map((block, i) => {
                  const trimmed = block.trim();
                  if (!trimmed) return null;
                  const lines = trimmed.split("\n").filter((l) => l.trim());
                  const isAllBullets = lines.every((l) => /^\s*[-*•]\s+/.test(l));
                  const isHeading = lines.length === 1 && /^(#+\s+|\*\*[^*]+\*\*\s*:?\s*$|[A-ZÄÖÜÕ\s]{4,}:?$)/.test(lines[0]);

                  if (isHeading) {
                    return (
                      <h4 key={i} className="font-semibold text-foreground text-sm mt-2 first:mt-0">
                        {lines[0].replace(/^#+\s+/, "").replace(/\*\*/g, "").replace(/:$/, "")}
                      </h4>
                    );
                  }
                  if (isAllBullets) {
                    return (
                      <ul key={i} className="list-disc pl-5 space-y-1">
                        {lines.map((l, j) => (
                          <li key={j}>{l.replace(/^\s*[-*•]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1")}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="whitespace-pre-line">
                      {trimmed.replace(/\*\*(.+?)\*\*/g, "$1")}
                    </p>
                  );
                })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
