import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Loader2, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { callService } from "@/services/callService";
import { supabase } from "@/integrations/supabase/client";

interface QuickTestCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  agentId: string;
}

export function QuickTestCallDialog({ open, onOpenChange, agentName, agentId }: QuickTestCallDialogProps) {
  const [testNumber, setTestNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lastCallAt, setLastCallAt] = useState<string | null>(null);
  const [lastCallStatus, setLastCallStatus] = useState<string | null>(null);

  // Load saved test number from agent settings
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("agents")
        .select("settings")
        .eq("id", agentId)
        .single();
      if (data?.settings) {
        const s = data.settings as Record<string, unknown>;
        if (typeof s.default_test_call_number === "string") setTestNumber(s.default_test_call_number);
        if (typeof s.last_test_call_at === "string") setLastCallAt(s.last_test_call_at);
        if (typeof s.last_test_call_status === "string") setLastCallStatus(s.last_test_call_status);
      }
    })();
  }, [open, agentId]);

  const saveTestNumber = async (number: string) => {
    setIsSaving(true);
    try {
      // Merge into existing settings
      const { data: current } = await supabase.from("agents").select("settings").eq("id", agentId).single();
      const existing = (current?.settings as Record<string, unknown>) || {};
      await supabase
        .from("agents")
        .update({ settings: { ...existing, default_test_call_number: number } as any })
        .eq("id", agentId);
      toast.success("Test number saved");
      setEditing(false);
    } catch {
      toast.error("Failed to save test number");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCall = async () => {
    if (!testNumber) {
      setEditing(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await callService.startCall({
        to_number: testNumber,
        agent_id: agentId,
        variables: { call_type: "test" },
      });

      const now = new Date().toISOString();
      const status = response.success ? "started" : "failed";

      // Update last test call metadata
      const { data: current } = await supabase.from("agents").select("settings").eq("id", agentId).single();
      const existing = (current?.settings as Record<string, unknown>) || {};
      await supabase
        .from("agents")
        .update({
          settings: {
            ...existing,
            default_test_call_number: testNumber,
            last_test_call_at: now,
            last_test_call_status: status,
          } as any,
        })
        .eq("id", agentId);

      setLastCallAt(now);
      setLastCallStatus(status);

      if (response.success) {
        toast.success(`Test call initiated to ${testNumber}`);
        onOpenChange(false);
      } else if ((response as any).status === "out_of_schedule") {
        toast.warning(response.error || "Agent is outside its calling schedule", {
          description: "Adjust the agent's Schedule tab or wait until the next calling window.",
          duration: 8000,
        });
      } else {
        toast.error(response.error || "Failed to start call");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start call");
    } finally {
      setIsLoading(false);
    }
  };

  const hasNumber = !!testNumber.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Test Call — {agentName}
          </DialogTitle>
          <DialogDescription>
            Initiate a real test call using this agent's configuration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Number display / edit */}
          {!editing && hasNumber ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Test number</p>
                <p className="font-mono text-sm text-foreground">{testNumber}</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
                <Settings2 className="h-3.5 w-3.5" />
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="testNum">
                {hasNumber ? "Update test number" : "Set a test phone number"}
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="testNum"
                    placeholder="+372 5XXX XXXX"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    className="pl-10 font-mono"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveTestNumber(testNumber)}
                  disabled={!testNumber.trim() || isSaving}
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* Last call info */}
          {lastCallAt && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Last test: {new Date(lastCallAt).toLocaleString()}</span>
              {lastCallStatus && (
                <span className={lastCallStatus === "started" ? "text-success" : "text-destructive"}>
                  ({lastCallStatus})
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCall} disabled={isLoading} className="gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                {hasNumber ? "Call Now" : "Set Number"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
