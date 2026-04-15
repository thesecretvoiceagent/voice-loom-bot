import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Node, Edge, Viewport } from "@xyflow/react";

export interface AgentFlow {
  id: string;
  agent_id: string;
  user_id: string;
  name: string;
  status: "draft" | "published";
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_NODES: Node[] = [
  {
    id: "start-1",
    type: "startNode",
    position: { x: 400, y: 50 },
    data: { label: "Start" },
  },
];

export function useAgentFlow(agentId: string) {
  const [flow, setFlow] = useState<AgentFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFlow = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("agent_flows")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFlow({
          ...data,
          status: data.status as "draft" | "published",
          nodes: (data.nodes as unknown as Node[]) || [],
          edges: (data.edges as unknown as Edge[]) || [],
          viewport: (data.viewport as unknown as Viewport) || { x: 0, y: 0, zoom: 1 },
        });
        setLastSaved(new Date(data.updated_at));
      } else {
        setFlow(null);
      }
    } catch (err) {
      console.error("Failed to fetch flow:", err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchFlow();
  }, [fetchFlow]);

  const createFlow = async (userId: string): Promise<AgentFlow> => {
    const { data, error } = await supabase
      .from("agent_flows")
      .insert({
        agent_id: agentId,
        user_id: userId,
        nodes: DEFAULT_NODES as any,
        edges: [] as any,
      })
      .select()
      .single();

    if (error) throw error;
    const created = {
      ...data,
      status: data.status as "draft" | "published",
      nodes: (data.nodes as unknown as Node[]) || DEFAULT_NODES,
      edges: (data.edges as unknown as Edge[]) || [],
      viewport: (data.viewport as unknown as Viewport) || { x: 0, y: 0, zoom: 1 },
    };
    setFlow(created);
    setLastSaved(new Date());
    return created;
  };

  const saveFlow = useCallback(
    async (nodes: Node[], edges: Edge[], viewport?: Viewport) => {
      if (!flow) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from("agent_flows")
          .update({
            nodes: nodes as any,
            edges: edges as any,
            ...(viewport ? { viewport: viewport as any } : {}),
          })
          .eq("id", flow.id);

        if (error) throw error;
        setLastSaved(new Date());
        setFlow((prev) => (prev ? { ...prev, nodes, edges, ...(viewport ? { viewport } : {}) } : null));
      } finally {
        setSaving(false);
      }
    },
    [flow]
  );

  const publishFlow = async () => {
    if (!flow) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agent_flows")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          version: flow.version + 1,
        })
        .eq("id", flow.id);

      if (error) throw error;
      setFlow((prev) => prev ? { ...prev, status: "published", version: prev.version + 1 } : null);
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutoSave = useCallback(
    (nodes: Node[], edges: Edge[], viewport?: Viewport) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        saveFlow(nodes, edges, viewport);
      }, 2000);
    },
    [saveFlow]
  );

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  return { flow, loading, saving, lastSaved, createFlow, saveFlow, publishFlow, scheduleAutoSave };
}
