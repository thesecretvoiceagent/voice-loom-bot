import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  value: string | null;
  scope: "global" | "env" | "tenant";
  notes: string | null;
  updated_by_user_id: string | null;
  updated_at: string;
}

// In-memory cache with TTL
let flagsCache: Map<string, FeatureFlag> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export const featureFlagService = {
  async getAll(): Promise<FeatureFlag[]> {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .order("key");

    if (error) {
      console.error("Failed to fetch feature flags:", error);
      return [];
    }

    // Update cache
    flagsCache.clear();
    (data || []).forEach((flag: FeatureFlag) => {
      flagsCache.set(flag.key, flag);
    });
    cacheTimestamp = Date.now();

    return data || [];
  },

  async get(key: string): Promise<FeatureFlag | null> {
    // Check cache first
    if (Date.now() - cacheTimestamp < CACHE_TTL_MS && flagsCache.has(key)) {
      return flagsCache.get(key) || null;
    }

    const { data, error } = await supabase
      .from("feature_flags")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch flag ${key}:`, error);
      return null;
    }

    if (data) {
      flagsCache.set(key, data);
    }

    return data;
  },

  async isEnabled(key: string, defaultValue: boolean = false): Promise<boolean> {
    const flag = await this.get(key);
    return flag?.enabled ?? defaultValue;
  },

  async getValue(key: string): Promise<string | null> {
    const flag = await this.get(key);
    return flag?.value ?? null;
  },

  async setFlag(
    key: string,
    enabled: boolean,
    value?: string | null,
    notes?: string
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("feature_flags")
      .update({
        enabled,
        value: value ?? null,
        notes: notes ?? null,
        updated_by_user_id: user?.id ?? null,
      })
      .eq("key", key);

    if (error) {
      console.error(`Failed to update flag ${key}:`, error);
      return false;
    }

    // Invalidate cache
    flagsCache.delete(key);
    return true;
  },

  async createFlag(
    key: string,
    enabled: boolean = true,
    value?: string | null,
    notes?: string
  ): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("feature_flags")
      .insert({
        key,
        enabled,
        value: value ?? null,
        notes: notes ?? null,
        updated_by_user_id: user?.id ?? null,
      });

    if (error) {
      console.error(`Failed to create flag ${key}:`, error);
      return false;
    }

    return true;
  },

  clearCache(): void {
    flagsCache.clear();
    cacheTimestamp = 0;
  },
};
