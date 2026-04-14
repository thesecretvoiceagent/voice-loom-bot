import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Download, Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callData: {
    phone: string;
    agent: string;
    timestamp: string;
    duration: string;
    transcript?: string;
  };
}

interface TranscriptTurn {
  speaker: "agent" | "user";
  text: string;
}

function parseTranscript(raw?: string): TranscriptTurn[] {
  if (!raw) return [];
  
  // Try to parse structured transcript (JSON array)
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Not JSON, try line-based parsing
  }

  // Parse line-based format: "[Agent]: ...", "Agent: ...", etc.
  const lines = raw.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    // Match [Agent]: ..., [AI]: ..., Agent: ..., AI: ..., etc.
    const agentMatch = line.match(/^\[?(AI|Agent|Bot|Assistant)\]?:\s*(.+)/i);
    if (agentMatch) return { speaker: "agent" as const, text: agentMatch[2] };
    const userMatch = line.match(/^\[?(User|Customer|Caller|Human)\]?:\s*(.+)/i);
    if (userMatch) return { speaker: "user" as const, text: userMatch[2] };
    // System messages
    const systemMatch = line.match(/^\[?System\]?:\s*(.+)/i);
    if (systemMatch) return { speaker: "agent" as const, text: `⚙️ ${systemMatch[1]}` };
    return { speaker: "user" as const, text: line };
  });
}

export function TranscriptDialog({ open, onOpenChange, callData }: TranscriptDialogProps) {
  const turns = parseTranscript(callData.transcript);

  const downloadTranscript = () => {
    const text = callData.transcript || turns
      .map((t) => `${t.speaker === "agent" ? "AI Agent" : "Customer"}: ${t.text}`)
      .join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${callData.phone.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Call Transcript
          </DialogTitle>
          <DialogDescription>
            {callData.phone} • {callData.agent} • {callData.duration}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4 py-4">
            {turns.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {callData.transcript ? (
                  <span className="whitespace-pre-wrap">{callData.transcript}</span>
                ) : (
                  "No transcript available"
                )}
              </p>
            ) : (
              turns.map((turn, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${turn.speaker === "agent" ? "" : "flex-row-reverse"}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      turn.speaker === "agent" ? "bg-primary/10" : "bg-secondary"
                    }`}
                  >
                    {turn.speaker === "agent" ? (
                      <Bot className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div
                    className={`flex-1 rounded-xl p-3 ${
                      turn.speaker === "agent"
                        ? "bg-primary/5 border border-primary/20"
                        : "bg-secondary/50 border border-border/50"
                    }`}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {turn.speaker === "agent" ? "AI Agent" : "Customer"}
                    </p>
                    <p className="text-sm text-foreground">{turn.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {(turns.length > 0 || callData.transcript) && (
          <div className="flex justify-end pt-4 border-t border-border">
            <Button variant="outline" onClick={downloadTranscript} className="gap-2">
              <Download className="h-4 w-4" />
              Download Transcript
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
