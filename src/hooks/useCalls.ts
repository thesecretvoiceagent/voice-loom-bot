import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CallRow {
  id: string;
  twilio_call_sid: string | null;
  agent_id: string | null;
  campaign_id: string | null;
  to_number: string;
  from_number: string | null;
  status: string;
  direction: string;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseCallsOptions {
  status?: string;
  direction?: string;
  agent_id?: string;
  campaign_id?: string;
  limit?: number;
  realtime?: boolean;
}

export function useCalls(options: UseCallsOptions = {}) {
  const { status, direction, agent_id, campaign_id, limit = 100, realtime = true } = options;
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      let query = supabase
        .from("calls")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) query = query.eq("status", status);
      if (direction) query = query.eq("direction", direction);
      if (agent_id) query = query.eq("agent_id", agent_id);
      if (campaign_id) query = query.eq("campaign_id", campaign_id);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setCalls((data as CallRow[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch calls");
    } finally {
      setLoading(false);
    }
  }, [status, direction, agent_id, campaign_id, limit]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Realtime subscription
  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls" },
        () => {
          fetchCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, fetchCalls]);

  // Computed stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCalls = calls.filter(
      (c) => new Date(c.created_at) >= today
    );
    const inbound = todayCalls.filter((c) => c.direction === "inbound");
    const outbound = todayCalls.filter((c) => c.direction === "outbound");
    const completed = todayCalls.filter((c) => c.status === "completed");

    const totalDuration = completed.reduce(
      (sum, c) => sum + (c.duration_seconds || 0),
      0
    );
    const avgDuration = completed.length > 0 ? totalDuration / completed.length : 0;
    const avgMin = Math.floor(avgDuration / 60);
    const avgSec = Math.round(avgDuration % 60);

    return {
      totalToday: todayCalls.length,
      inboundToday: inbound.length,
      outboundToday: outbound.length,
      avgDuration: `${avgMin}:${avgSec.toString().padStart(2, "0")}`,
      completedToday: completed.length,
      failedToday: todayCalls.filter((c) => ["failed", "busy", "no-answer", "canceled"].includes(c.status)).length,
    };
  }, [calls]);

  // Hourly chart data for today
  const chartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCalls = calls.filter(
      (c) => new Date(c.created_at) >= today
    );

    const hours = Array.from({ length: 24 }, (_, i) => {
      const hourCalls = todayCalls.filter((c) => {
        const h = new Date(c.created_at).getHours();
        return h === i;
      });
      return {
        time: `${i.toString().padStart(2, "0")}:00`,
        inbound: hourCalls.filter((c) => c.direction === "inbound").length,
        outbound: hourCalls.filter((c) => c.direction === "outbound").length,
      };
    });

    return hours;
  }, [calls]);

  return { calls, loading, error, stats, chartData, refetch: fetchCalls };
}
