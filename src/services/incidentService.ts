import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type IncidentSeverity = "info" | "warn" | "critical";

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  source: string;
  message: string;
  meta: Json;
  created_at: string;
}

export const incidentService = {
  async getAll(limit: number = 100): Promise<Incident[]> {
    const { data, error } = await supabase
      .from("incident_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch incidents:", error);
      return [];
    }

    return (data || []) as Incident[];
  },

  async getBySource(source: string, limit: number = 50): Promise<Incident[]> {
    const { data, error } = await supabase
      .from("incident_log")
      .select("*")
      .eq("source", source)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Failed to fetch incidents for ${source}:`, error);
      return [];
    }

    return (data || []) as Incident[];
  },

  async getBySeverity(severity: IncidentSeverity, limit: number = 50): Promise<Incident[]> {
    const { data, error } = await supabase
      .from("incident_log")
      .select("*")
      .eq("severity", severity)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Failed to fetch ${severity} incidents:`, error);
      return [];
    }

    return (data || []) as Incident[];
  },

  async log(
    severity: IncidentSeverity,
    source: string,
    message: string,
    meta: Record<string, unknown> = {}
  ): Promise<boolean> {
    const { error } = await supabase
      .from("incident_log")
      .insert([{
        severity,
        source,
        message,
        meta: meta as Json,
      }]);

    if (error) {
      console.error("Failed to log incident:", error);
      return false;
    }

    return true;
  },

  async getRecent(hours: number = 24): Promise<Incident[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("incident_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch recent incidents:", error);
      return [];
    }

    return (data || []) as Incident[];
  },

  async getStats(): Promise<{ info: number; warn: number; critical: number }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("incident_log")
      .select("severity")
      .gte("created_at", since);

    if (error) {
      console.error("Failed to fetch incident stats:", error);
      return { info: 0, warn: 0, critical: 0 };
    }

    const stats = { info: 0, warn: 0, critical: 0 };
    (data || []).forEach((incident) => {
      const sev = incident.severity as IncidentSeverity;
      if (sev in stats) stats[sev]++;
    });

    return stats;
  },
};
