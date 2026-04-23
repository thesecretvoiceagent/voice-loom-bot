import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  type: "inbound" | "outbound";
  is_active: boolean;
  greeting: string;
  system_prompt: string;
  analysis_prompt: string;
  voice: string;
  phone_number: string;
  tools: string[];
  settings: {
    max_ring_time: number;
    max_call_duration: number;
    max_retries: number;
    concurrent_calls: number;
    retry_delay_hours: number;
    retry_delay_minutes: number;
    enable_recording: boolean;
  };
  schedule: {
    start_time: string;
    end_time: string;
    days: string[];
    timezone: string;
  };
  knowledge_base: unknown[];
  tenant_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type AgentInsert = Omit<AgentRow, "id" | "created_at" | "updated_at">;
export type AgentUpdate = Partial<Omit<AgentRow, "id" | "user_id" | "created_at" | "updated_at">>;

export interface UseAgentsOptions {
  tenant_id?: string;
}

export function useAgents(options: UseAgentsOptions = {}) {
  const { tenant_id } = options;
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      let query = supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (tenant_id) query = query.eq("tenant_id", tenant_id);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setAgents((data as unknown as AgentRow[]) || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  }, [tenant_id]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);


  const createAgent = async (agent: AgentInsert): Promise<AgentRow | null> => {
    const { data, error } = await supabase
      .from("agents")
      .insert(agent as any)
      .select()
      .single();

    if (error) throw new Error(error.message);
    await fetchAgents();
    return data as unknown as AgentRow;
  };

  const updateAgent = async (id: string, updates: AgentUpdate): Promise<void> => {
    const { error } = await supabase
      .from("agents")
      .update(updates as any)
      .eq("id", id);

    if (error) throw new Error(error.message);
    await fetchAgents();
  };

  const deleteAgent = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);
    await fetchAgents();
  };

  const toggleAgent = async (id: string, isActive: boolean): Promise<void> => {
    await updateAgent(id, { is_active: isActive });
  };

  return { agents, loading, error, createAgent, updateAgent, deleteAgent, toggleAgent, refetch: fetchAgents };
}
