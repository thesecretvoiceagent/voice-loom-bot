import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface OrganizationSettings {
  id: string;
  api_key: string | null;
  api_key_created_at: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_secret_created_at: string | null;
}

export function useOrganizationSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("organization_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  const generateApiKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { type: "api_key" },
      });

      if (error) throw error;
      
      toast.success("API key generated successfully");
      await fetchSettings();
      return data.api_key;
    } catch (error: any) {
      toast.error("Failed to generate API key");
      console.error(error);
    }
  };

  const generateWebhookSecret = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-api-key", {
        body: { type: "webhook_secret" },
      });

      if (error) throw error;
      
      toast.success("Webhook secret generated successfully");
      await fetchSettings();
      return data.webhook_secret;
    } catch (error: any) {
      toast.error("Failed to generate webhook secret");
      console.error(error);
    }
  };

  const updateWebhookUrl = async (url: string) => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from("organization_settings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("organization_settings")
          .update({ webhook_url: url })
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("organization_settings")
          .insert({ user_id: user.id, webhook_url: url });

        if (error) throw error;
      }

      toast.success("Webhook URL saved successfully");
      await fetchSettings();
    } catch (error: any) {
      toast.error("Failed to save webhook URL");
      console.error(error);
    }
  };

  const deleteApiKey = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("organization_settings")
        .update({ api_key: null, api_key_created_at: null })
        .eq("user_id", user.id);

      if (error) throw error;
      
      toast.success("API key deleted successfully");
      await fetchSettings();
    } catch (error: any) {
      toast.error("Failed to delete API key");
      console.error(error);
    }
  };

  return {
    settings,
    loading,
    generateApiKey,
    generateWebhookSecret,
    updateWebhookUrl,
    deleteApiKey,
    refetch: fetchSettings,
  };
}
