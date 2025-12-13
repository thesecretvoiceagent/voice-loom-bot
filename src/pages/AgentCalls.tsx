import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Play,
  Pause,
  Volume2,
  FileText,
  MoreVertical,
  PhoneOutgoing,
  PhoneIncoming,
  User,
  Phone,
  Clock,
  Calendar,
  MessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const callLogs = [
  {
    id: "1",
    contact: "Alar Tamm",
    toNumber: "+37253402318",
    fromNumber: "+37256011298",
    direction: "outbound",
    startTime: "Dec 3, 2025, 17:43",
    endTime: "Dec 3, 2025, 17:45",
    duration: "1m 16s",
    turns: "1/4",
    status: "completed",
    updatedAt: "Dec 3, 2025, 17:43",
    aiSummary: "Called Henri who wanted to book an appointment at Barbershop. He wanted to book for Friday...",
    transcript: [
      { speaker: "agent", text: "Hello Kristjan! This is Barbershop calling. What time would you like to book?" },
      { speaker: "user", text: "Yes, okay, please book me for Friday at three thirty in the afternoon, please." },
      { speaker: "agent", text: "Alright. Let me check Friday's schedule and see if three thirty is available. One moment..." },
      { speaker: "user", text: "Well, at three-- at three thirty, please." },
      { speaker: "agent", text: "Let me check. Yes, one moment. Good news. Friday at three thirty is available. Let's book that. Please tell me your name and phone number." },
      { speaker: "user", text: "Yes, uh, my name is Henri and my phone number is one, one, one, one, one, one, one." },
      { speaker: "agent", text: "Okay. Henri, is this booking for a haircut, beard grooming, or both together?" },
      { speaker: "user", text: "Beard grooming, please." },
      { speaker: "agent", text: "Got it. Your booking is for Friday at three thirty, service \"Beard Grooming\". See you at Barber Shop then. Have a nice day!" },
    ],
  },
  {
    id: "2",
    contact: "Alar Tamm",
    toNumber: "+37253402318",
    fromNumber: "+37256011298",
    direction: "outbound",
    startTime: "Dec 3, 2025, 17:42",
    endTime: "Dec 3, 2025, 17:43",
    duration: "48s",
    turns: "1/4",
    status: "completed",
    updatedAt: "Dec 3, 2025, 17:42",
    aiSummary: "The caller was an AI agent who wanted to book an appointment at Barbershop. He wanted to book for...",
    transcript: [
      { speaker: "agent", text: "Hello! This is Barbershop AI calling. How can I help you today?" },
      { speaker: "user", text: "I'd like to book an appointment for a haircut." },
    ],
  },
  {
    id: "3",
    contact: "Alar Tamm",
    toNumber: "+37253402318",
    fromNumber: "+37256011298",
    direction: "outbound",
    startTime: "Dec 3, 2025, 17:30",
    endTime: "Dec 3, 2025, 17:32",
    duration: "1m 56s",
    turns: "1/4",
    status: "completed",
    updatedAt: "Dec 3, 2025, 17:30",
    aiSummary: "Called Henry who wanted to book an appointment at Barbershop. He wanted to book for...",
    transcript: [],
  },
];

export default function AgentCalls() {
  const { id } = useParams();
  const [filter, setFilter] = useState("all");
  const [transcriptModal, setTranscriptModal] = useState<typeof callLogs[0] | null>(null);
  const [summaryModal, setSummaryModal] = useState<typeof callLogs[0] | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const agentName = "Edvini AI";

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
            Detailed campaign "{agentName}" call logs.
            <br />
            <span className="text-sm">Showing 1-3 / 3 calls</span>
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
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
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
                  <User className="h-4 w-4" />
                  Contact
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  Phone Numbers
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  ↕ Direction
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Call Time
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  📊 Status
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Updated
                </div>
              </TableHead>
              <TableHead className="text-muted-foreground">AI Summary</TableHead>
              <TableHead className="text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {callLogs.map((call) => (
              <TableRow
                key={call.id}
                className="border-border hover:bg-secondary/30"
              >
                <TableCell>
                  <span className="font-medium">{call.contact}</span>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 text-sm">
                    <p className="text-muted-foreground">
                      To: <span className="font-mono">{call.toNumber}</span>
                    </p>
                    <p className="text-muted-foreground">
                      From: <span className="font-mono">{call.fromNumber}</span>
                    </p>
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
                  <div className="space-y-0.5 text-sm">
                    <p className="text-muted-foreground">
                      Start: {call.startTime}
                    </p>
                    <p className="text-muted-foreground">
                      End: {call.endTime}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-success/10 text-success text-xs px-2 py-0.5 rounded-full font-medium">
                        Completed
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {call.duration}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        📊 {call.turns}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 bg-success/10 text-success text-xs px-2.5 py-1 rounded-full font-medium">
                    Completed
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {call.updatedAt}
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                    {call.aiSummary}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {/* Audio Player */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setPlayingAudio(
                            playingAudio === call.id ? null : call.id
                          )
                        }
                      >
                        {playingAudio === call.id ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <span>0:00 / {call.duration.replace("m ", ":").replace("s", "")}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Volume2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setTranscriptModal(call)}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Transcript
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
            <p className="text-sm text-muted-foreground">
              View the full transcript and call details
            </p>
          </DialogHeader>

          {transcriptModal && (
            <div className="flex-1 overflow-auto space-y-6">
              {/* Call Info */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Contact:</span>{" "}
                    <span className="font-medium">{transcriptModal.contact}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <span className="font-mono">{transcriptModal.toNumber}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <span className="text-muted-foreground">Time:</span>{" "}
                    {transcriptModal.startTime}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-success/10 text-success text-xs px-2 py-0.5 rounded-full font-medium">
                    <span className="text-muted-foreground mr-1">Status:</span>
                    Completed
                  </span>
                </div>
              </div>

              {/* Transcript */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">Transcript</h4>
                <div className="space-y-3 p-4 rounded-lg bg-muted/30 max-h-[300px] overflow-auto">
                  {transcriptModal.transcript.map((turn, index) => (
                    <p key={index} className="text-sm">
                      <span
                        className={cn(
                          "font-semibold",
                          turn.speaker === "agent"
                            ? "text-primary"
                            : "text-orange-500"
                        )}
                      >
                        [{turn.speaker === "agent" ? "Agent" : "User"}]
                      </span>{" "}
                      <span className="text-foreground">{turn.text}</span>
                    </p>
                  ))}
                </div>
              </div>

              {/* AI Summary Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  setTranscriptModal(null);
                  setSummaryModal(transcriptModal);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                View AI Summary
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Summary Modal */}
      <Dialog open={!!summaryModal} onOpenChange={() => setSummaryModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              AI Call Summary
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Call with {summaryModal?.contact} on {summaryModal?.startTime}
            </p>
          </DialogHeader>

          {summaryModal && (
            <div className="space-y-4">
              <p className="text-sm text-foreground leading-relaxed">
                {summaryModal.aiSummary}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                The caller was an AI agent who wanted to book an appointment at
                Barbershop. The client wanted a booking at 13:00 on 06.12.2023.
                They also wanted a haircut and beard grooming. The agent noted
                that the date might be wrong, as Friday is actually 05.12.2023.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
