/**
 * Agent schedule enforcement (frontend mirror of orchestrator/src/schedule.ts).
 *
 * Decides whether an agent is allowed to start/accept calls "right now",
 * given its configured calling hours, weekdays, and timezone.
 *
 * Uses Intl.DateTimeFormat — no extra deps. Handles overnight windows
 * (e.g. 22:00 → 06:00) and DST automatically because it asks the runtime
 * for the local wall-clock time in the agent's IANA zone.
 */

export type AgentSchedule = {
  start_time?: string | null; // "HH:MM" 24h
  end_time?: string | null;   // "HH:MM" 24h
  days?: string[] | null;     // ["mon","tue",...]
  timezone?: string | null;   // IANA, e.g. "Europe/Tallinn"
} | null | undefined;

export type ScheduleStatus = {
  allowed: boolean;
  reason: "ok" | "off_day" | "off_hours" | "no_days" | "no_hours";
  /** Wall-clock minutes since midnight in agent timezone. */
  nowMinutes: number;
  /** "mon"..."sun" in agent timezone. */
  dayKey: string;
  /** Pretty "HH:MM" in agent timezone. */
  localTime: string;
  timezone: string;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseHHMM(value: string | null | undefined, fallback: number): number {
  if (!value || typeof value !== "string") return fallback;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}

/** Get the wall-clock day-of-week + minutes-since-midnight in `tz`. */
export function getLocalParts(now: Date, tz: string): { dayKey: string; minutes: number; hh: string; mm: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
  } catch {
    // Invalid timezone → fall back to UTC so we still produce a sane answer.
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour12: false,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(now);
  }
  const wk = (parts.find((p) => p.type === "weekday")?.value || "Mon").toLowerCase().slice(0, 3);
  let hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Intl can return "24" at midnight on some engines.
  if (hh === "24") hh = "00";
  const minutes = parseInt(hh, 10) * 60 + parseInt(mm, 10);
  return { dayKey: wk, minutes, hh, mm };
}

/**
 * Check whether the agent is allowed to call right now.
 * Defaults are permissive: missing schedule → allowed.
 */
export function evaluateSchedule(schedule: AgentSchedule, now: Date = new Date()): ScheduleStatus {
  const tz = (schedule?.timezone && typeof schedule.timezone === "string" && schedule.timezone.trim()) || "UTC";
  const { dayKey, minutes, hh, mm } = getLocalParts(now, tz);
  const localTime = `${hh}:${mm}`;

  const days = Array.isArray(schedule?.days)
    ? (schedule!.days as string[]).map((d) => String(d).toLowerCase().slice(0, 3))
    : null;

  // No schedule at all → allow.
  if (!schedule) {
    return { allowed: true, reason: "ok", nowMinutes: minutes, dayKey, localTime, timezone: tz };
  }

  if (days && days.length === 0) {
    return { allowed: false, reason: "no_days", nowMinutes: minutes, dayKey, localTime, timezone: tz };
  }

  if (days && !days.includes(dayKey)) {
    return { allowed: false, reason: "off_day", nowMinutes: minutes, dayKey, localTime, timezone: tz };
  }

  const startStr = schedule.start_time;
  const endStr = schedule.end_time;
  if (!startStr || !endStr) {
    // No hours configured → allow (only days were set).
    return { allowed: true, reason: "ok", nowMinutes: minutes, dayKey, localTime, timezone: tz };
  }

  const start = parseHHMM(startStr, 0);
  const end = parseHHMM(endStr, 24 * 60);

  // Treat 00:00–00:00 as "always".
  if (start === end) {
    return { allowed: true, reason: "ok", nowMinutes: minutes, dayKey, localTime, timezone: tz };
  }

  let inWindow: boolean;
  if (start < end) {
    // Same-day window: [start, end)
    inWindow = minutes >= start && minutes < end;
  } else {
    // Overnight window: [start, 24:00) ∪ [00:00, end)
    inWindow = minutes >= start || minutes < end;
  }

  return {
    allowed: inWindow,
    reason: inWindow ? "ok" : "off_hours",
    nowMinutes: minutes,
    dayKey,
    localTime,
    timezone: tz,
  };
}

export function describeScheduleBlock(status: ScheduleStatus, schedule: AgentSchedule): string {
  if (status.allowed) return "Within calling hours";
  const tz = status.timezone;
  if (status.reason === "off_day" || status.reason === "no_days") {
    const allowed = (schedule?.days || []).map((d) => String(d).slice(0, 3).toUpperCase()).join(", ");
    return `Outside calling days — today is ${status.dayKey.toUpperCase()} (${tz}). Allowed: ${allowed || "none"}.`;
  }
  if (status.reason === "off_hours") {
    return `Outside calling hours — local time is ${status.localTime} (${tz}). Window: ${schedule?.start_time}–${schedule?.end_time}.`;
  }
  return "Outside calling schedule.";
}

export { DAY_KEYS };
