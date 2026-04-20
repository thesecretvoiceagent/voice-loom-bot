import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingStatusProps {
  status: string;
  endedAt: string | null;
  createdAt: string;
  className?: string;
}

const PENDING_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Shows a "Recording pending" pill when a call recently completed but the
 * recording_url hasn't arrived yet (Twilio recording status callback can lag
 * 30-90s). After the 2-minute window elapses, shows nothing (caller renders "—").
 *
 * Returns null if the call shouldn't be considered pending at all.
 */
export function RecordingStatus({ status, endedAt, createdAt, className }: RecordingStatusProps) {
  // Tick every 15s so the pending state automatically clears after the window.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // Only completed/in-progress calls produce recordings worth waiting on.
  const eligibleStatuses = ["completed", "in-progress"];
  if (!eligibleStatuses.includes(status)) return null;

  const reference = endedAt || createdAt;
  if (!reference) return null;

  const elapsed = Date.now() - new Date(reference).getTime();
  if (elapsed < 0 || elapsed > PENDING_WINDOW_MS) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full",
        "bg-warning/10 text-warning border border-warning/30",
        className
      )}
      title="Twilio is finalizing the recording (usually 30–90s after the call ends)"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Recording pending
    </span>
  );
}
