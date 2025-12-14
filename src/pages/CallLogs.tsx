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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TranscriptDialog } from "@/components/call-logs/TranscriptDialog";
import { Card } from "@/components/ui/card";

const callLogs = [
  {
    id: 1,
    phone: "+372 5123 4567",
    type: "inbound",
    agent: "Sales Assistant",
    duration: "3:42",
    status: "completed",
    outcome: "Lead qualified",
    timestamp: "2025-12-13 14:32:15",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: 2,
    phone: "+372 5234 5678",
    type: "outbound",
    agent: "Reminder Bot",
    duration: "1:15",
    status: "completed",
    outcome: "Payment confirmed",
    timestamp: "2025-12-13 14:28:42",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: 3,
    phone: "+372 5345 6789",
    type: "inbound",
    agent: "Support Agent",
    duration: "0:00",
    status: "missed",
    outcome: "No answer",
    timestamp: "2025-12-13 14:15:33",
    hasRecording: false,
    hasTranscript: false,
  },
  {
    id: 4,
    phone: "+372 5456 7890",
    type: "outbound",
    agent: "Collection Agent",
    duration: "2:30",
    status: "completed",
    outcome: "Payment plan agreed",
    timestamp: "2025-12-13 14:08:21",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: 5,
    phone: "+372 5567 8901",
    type: "inbound",
    agent: "Sales Assistant",
    duration: "5:12",
    status: "in_progress",
    outcome: "Active call",
    timestamp: "2025-12-13 14:05:00",
    hasRecording: false,
    hasTranscript: false,
  },
  {
    id: 6,
    phone: "+372 5678 9012",
    type: "outbound",
    agent: "Survey Bot",
    duration: "1:48",
    status: "completed",
    outcome: "Survey completed",
    timestamp: "2025-12-13 13:55:12",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: 7,
    phone: "+372 5789 0123",
    type: "outbound",
    agent: "Reminder Bot",
    duration: "0:32",
    status: "failed",
    outcome: "Voicemail",
    timestamp: "2025-12-13 13:48:45",
    hasRecording: true,
    hasTranscript: false,
  },
  {
    id: 8,
    phone: "+372 5890 1234",
    type: "inbound",
    agent: "Support Agent",
    duration: "8:15",
    status: "completed",
    outcome: "Issue resolved",
    timestamp: "2025-12-13 13:32:18",
    hasRecording: true,
    hasTranscript: true,
  },
];

export default function CallLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<typeof callLogs[0] | null>(null);
  const [retentionDays, setRetentionDays] = useState("90");

  const filteredLogs = callLogs.filter(
    (log) =>
      log.phone.includes(searchQuery) ||
      log.agent.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openTranscript = (call: typeof callLogs[0]) => {
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
              <TableHead className="text-muted-foreground">Outcome</TableHead>
              <TableHead className="text-muted-foreground">Time</TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow
                key={log.id}
                className="border-border hover:bg-secondary/30"
              >
                <TableCell>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      log.type === "inbound" ? "bg-success/10" : "bg-primary/10"
                    )}
                  >
                    {log.type === "inbound" ? (
                      <PhoneIncoming className="h-4 w-4 text-success" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                <TableCell className="text-sm">{log.agent}</TableCell>
                <TableCell className="font-mono text-sm">{log.duration}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {log.status === "completed" && (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    )}
                    {log.status === "missed" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    {log.status === "failed" && (
                      <XCircle className="h-4 w-4 text-warning" />
                    )}
                    {log.status === "in_progress" && (
                      <Clock className="h-4 w-4 text-primary animate-pulse" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        log.status === "completed" && "text-success",
                        log.status === "missed" && "text-destructive",
                        log.status === "failed" && "text-warning",
                        log.status === "in_progress" && "text-primary"
                      )}
                    >
                      {log.status.replace("_", " ")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.outcome}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.timestamp.split(" ")[1]}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {log.hasRecording && (
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {log.hasTranscript && (
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Transcript Dialog */}
      {selectedCall && (
        <TranscriptDialog
          open={transcriptDialogOpen}
          onOpenChange={setTranscriptDialogOpen}
          callData={{
            phone: selectedCall.phone,
            agent: selectedCall.agent,
            timestamp: selectedCall.timestamp,
            duration: selectedCall.duration,
          }}
        />
      )}
    </div>
  );
}
