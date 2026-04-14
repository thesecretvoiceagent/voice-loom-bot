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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TranscriptDialog } from "@/components/call-logs/TranscriptDialog";
import { Card } from "@/components/ui/card";
import { useCalls, type CallRow } from "@/hooks/useCalls";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { calls, loading } = useCalls({ limit: 200 });
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRow | null>(null);
  const [retentionDays, setRetentionDays] = useState("90");

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
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
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
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Type</TableHead>
              <TableHead className="text-muted-foreground">Phone</TableHead>
              <TableHead className="text-muted-foreground">Agent</TableHead>
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
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
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
                  <TableCell className="text-sm">{log.agent_id || "—"}</TableCell>
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
                      {["initiated", "ringing", "in-progress", "queued"].includes(log.status) && (
                        <Clock className="h-4 w-4 text-primary animate-pulse" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          log.status === "completed" && "text-success",
                          ["failed", "busy", "no-answer", "canceled"].includes(log.status) && "text-destructive",
                          ["initiated", "ringing", "in-progress", "queued"].includes(log.status) && "text-primary"
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
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={log.recording_url} target="_blank" rel="noopener noreferrer">
                            <Play className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {log.transcript && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openTranscript(log)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
