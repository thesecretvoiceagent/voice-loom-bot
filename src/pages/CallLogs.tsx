import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Filter,
  PhoneIncoming,
  PhoneOutgoing,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  FileText,
  Trash2,
  Settings,
  Loader2,
  Volume2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TranscriptDialog } from "@/components/call-logs/TranscriptDialog";
import { Card } from "@/components/ui/card";
import { useCalls, type CallRow } from "@/hooks/useCalls";
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

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function CallLogs() {
  const { calls, loading, refetch } = useCalls({ limit: 200 });
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);
  const [retentionDays, setRetentionDays] = useState("90");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);

  const filteredLogs = calls.filter(
    (log) =>
      log.to_number.includes(searchQuery) ||
      (log.from_number || "").includes(searchQuery) ||
      (log.agent_id || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openTranscript = (call: CallRow) => {
    setSelectedCall(call);
    setTranscriptDialogOpen(true);
  };

  const handleDelete = async (callId: string) => {
    if (!confirm("Delete this call log? This cannot be undone.")) return;
    setDeletingIds((prev) => new Set(prev).add(callId));
    try {
      const { error } = await supabase.from("calls").delete().eq("id", callId);
      if (error) throw error;
      toast.success("Call log deleted");
      refetch();
    } catch (err) {
      toast.error("Failed to delete call log");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(callId);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete all ${filteredLogs.length} visible call logs? This cannot be undone.`)) return;
    try {
      const ids = filteredLogs.map((c) => c.id);
      const { error } = await supabase.from("calls").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} call logs deleted`);
      refetch();
    } catch (err) {
      toast.error("Failed to delete call logs");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Logs</h1>
          <p className="mt-1 text-muted-foreground">
            View and analyze all call activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredLogs.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          )}
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Data Retention Settings */}
      <Card className="glass-card rounded-xl border-border/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Trash2 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Data Retention Policy</h3>
              <p className="text-sm text-muted-foreground">
                Automatically delete call logs and recordings after specified days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="retention" className="text-sm text-muted-foreground whitespace-nowrap">
              Delete after:
            </Label>
            <Select value={retentionDays} onValueChange={setRetentionDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by phone or agent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredLogs.length} call{filteredLogs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Phone</TableHead>
              <TableHead className="text-muted-foreground">Duration</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Summary</TableHead>
              <TableHead className="text-muted-foreground">Time</TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {calls.length === 0 ? "No calls recorded yet" : "No matching calls"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-border hover:bg-secondary/30"
                >
                  <TableCell>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        log.direction === "inbound" ? "bg-success/10" : "bg-primary/10"
                      )}
                    >
                      {log.direction === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-success" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.to_number}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDuration(log.duration_seconds)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {log.status === "completed" && (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                      {["failed", "busy", "no-answer", "canceled"].includes(log.status) && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {["initiated", "ringing", "in-progress", "queued", "pending"].includes(log.status) && (
                        <Clock className="h-4 w-4 text-primary animate-pulse" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          log.status === "completed" && "text-success",
                          ["failed", "busy", "no-answer", "canceled"].includes(log.status) && "text-destructive",
                          ["initiated", "ringing", "in-progress", "queued", "pending"].includes(log.status) && "text-primary"
                        )}
                      >
                        {log.status.replace(/-/g, " ")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {log.summary || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatTime(log.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {log.recording_url && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPlayingId(playingId === log.id ? null : log.id)}
                            title="Play recording"
                          >
                            <Volume2 className={cn("h-4 w-4", playingId === log.id && "text-primary")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                            title="Open recording in new tab"
                          >
                            <a
                              href={getProxiedRecordingUrl(log.recording_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(getProxiedRecordingUrl(log.recording_url!));
                                toast.success("Recording link copied");
                              } catch {
                                toast.error("Failed to copy link");
                              }
                            }}
                            title="Copy recording link"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {log.transcript && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openTranscript(log)}
                          title="View transcript"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(log.id)}
                        disabled={deletingIds.has(log.id)}
                        title="Delete"
                      >
                        {deletingIds.has(log.id) ? (
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

      {/* Inline Audio Player */}
      {playingId && (() => {
        const call = calls.find((c) => c.id === playingId);
        if (!call?.recording_url) return null;
        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-card rounded-xl p-4 shadow-elevated flex items-center gap-4 min-w-[400px]">
            <Volume2 className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground mb-2">
                Recording — {call.to_number}
              </p>
              <audio
                src={getProxiedRecordingUrl(call.recording_url)}
                controls
                autoPlay
                className="w-full h-8"
                onEnded={() => setPlayingId(null)}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setPlayingId(null)}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        );
      })()}

      {/* Transcript Dialog */}
      {selectedCall && (
        <TranscriptDialog
          open={transcriptDialogOpen}
          onOpenChange={setTranscriptDialogOpen}
          callData={{
            phone: selectedCall.to_number,
            agent: selectedCall.agent_id || "Unknown",
            timestamp: selectedCall.created_at,
            duration: formatDuration(selectedCall.duration_seconds),
            transcript: selectedCall.transcript || undefined,
          }}
        />
      )}
    </div>
  );
}