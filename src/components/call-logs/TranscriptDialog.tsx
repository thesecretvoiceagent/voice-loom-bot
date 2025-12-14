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
  };
}

// Mock transcript data
const mockTranscript = [
  { speaker: "agent", text: "Hello, this is Sarah from BeyondCode. How are you today?" },
  { speaker: "user", text: "Hi Sarah, I'm doing well, thank you for calling." },
  { speaker: "agent", text: "That's great to hear! I'm calling to follow up on your inquiry about our AI voice platform. Do you have a few minutes to discuss?" },
  { speaker: "user", text: "Yes, I have some time now. I was curious about the pricing and implementation timeline." },
  { speaker: "agent", text: "Perfect! Our platform starts at €20,000 for the complete setup, which includes all integrations, testing, and training. The implementation typically takes about 4 weeks from start to finish." },
  { speaker: "user", text: "That sounds reasonable. What about ongoing costs?" },
  { speaker: "agent", text: "For ongoing usage, we charge €0.20 per active talk-minute. This covers all calls, regardless of time of day or language. There are no hidden fees or per-call charges." },
  { speaker: "user", text: "Interesting. Can you tell me more about the supported languages?" },
  { speaker: "agent", text: "Absolutely! Our platform supports multiple languages including Estonian, English, Russian, German, and more. The AI can switch languages mid-conversation if needed." },
  { speaker: "user", text: "That's impressive. I'd like to schedule a demo with our team." },
  { speaker: "agent", text: "Wonderful! I can help arrange that. What day works best for your team - would Thursday or Friday of this week work?" },
  { speaker: "user", text: "Thursday afternoon would be perfect." },
  { speaker: "agent", text: "Excellent! I'll send you a calendar invite for Thursday at 2 PM. Is there anything else you'd like to know before we end the call?" },
  { speaker: "user", text: "No, that covers everything. Thank you for the information." },
  { speaker: "agent", text: "You're welcome! Looking forward to the demo. Have a great day!" },
];

export function TranscriptDialog({ open, onOpenChange, callData }: TranscriptDialogProps) {
  const downloadTranscript = () => {
    const text = mockTranscript
      .map(t => `${t.speaker === 'agent' ? 'AI Agent' : 'Customer'}: ${t.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${callData.phone.replace(/\s+/g, '_')}_${callData.timestamp.replace(/[:\s]/g, '-')}.txt`;
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
            {mockTranscript.map((turn, index) => (
              <div
                key={index}
                className={`flex gap-3 ${turn.speaker === 'agent' ? '' : 'flex-row-reverse'}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  turn.speaker === 'agent' ? 'bg-primary/10' : 'bg-secondary'
                }`}>
                  {turn.speaker === 'agent' ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className={`flex-1 rounded-xl p-3 ${
                  turn.speaker === 'agent' 
                    ? 'bg-primary/5 border border-primary/20' 
                    : 'bg-secondary/50 border border-border/50'
                }`}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {turn.speaker === 'agent' ? 'AI Agent' : 'Customer'}
                  </p>
                  <p className="text-sm text-foreground">{turn.text}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={downloadTranscript} className="gap-2">
            <Download className="h-4 w-4" />
            Download Transcript
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
