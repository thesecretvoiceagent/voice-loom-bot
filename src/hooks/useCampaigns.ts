import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CampaignRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: "active" | "paused" | "scheduled" | "completed";
  agent_id: string | null;
  contacts: number;
  completed: number;
  success_rate: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setCampaigns((data as unknown as CampaignRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await fetchCampaigns();
  };

  const updateCampaign = async (id: string, updates: Partial<CampaignRow>) => {
    const { error } = await supabase.from("campaigns").update(updates as any).eq("id", id);
    if (error) throw new Error(error.message);
    await fetchCampaigns();
  };

  const createCampaign = async (campaign: Omit<CampaignRow, "id" | "created_at" | "updated_at">) => {
    const { error } = await supabase.from("campaigns").insert(campaign as any);
    if (error) throw new Error(error.message);
    await fetchCampaigns();
  };

  return { campaigns, loading, deleteCampaign, updateCampaign, createCampaign, refetch: fetchCampaigns };
}
