import { supabase } from "@/integrations/supabase/client";
import { incidentService } from "./incidentService";

export type ProviderName = "supabase" | "twilio" | "openai" | "gemini" | "vercel_runtime" | "railway_workers";
export type ProviderState = "healthy" | "degraded" | "down";
export type CircuitState = "closed" | "open" | "half_open";

export interface ProviderStatus {
  id: string;
  provider: ProviderName;
  component: string;
  state: ProviderState;
  circuit: CircuitState;
  failure_count: number;
  success_count: number;
  last_error: string | null;
  last_checked_at: string;
  last_success_at: string | null;
  cooldown_until: string | null;
  updated_at: string;
}

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const EXTENDED_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes after half-open failure

export const circuitBreakerService = {
  async getAll(): Promise<ProviderStatus[]> {
    const { data, error } = await supabase
      .from("provider_status")
      .select("*")
      .order("provider");

    if (error) {
      console.error("Failed to fetch provider status:", error);
      return [];
    }

    return data || [];
  },

  async get(provider: ProviderName, component: string = "api"): Promise<ProviderStatus | null> {
    const { data, error } = await supabase
      .from("provider_status")
      .select("*")
      .eq("provider", provider)
      .eq("component", component)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch status for ${provider}/${component}:`, error);
      return null;
    }

    return data;
  },

  async isCircuitOpen(provider: ProviderName, component: string = "api"): Promise<boolean> {
    const status = await this.get(provider, component);
    if (!status) return false;

    // Check if cooldown has expired for open circuit
    if (status.circuit === "open" && status.cooldown_until) {
      const cooldownExpired = new Date(status.cooldown_until) < new Date();
      if (cooldownExpired) {
        // Transition to half-open
        await this.updateCircuit(provider, component, "half_open");
        return false; // Allow one test request
      }
      return true; // Circuit still open
    }

    return status.circuit === "open";
  },

  async recordSuccess(provider: ProviderName, component: string = "api"): Promise<void> {
    const status = await this.get(provider, component);
    if (!status) return;

    const updates: Partial<ProviderStatus> = {
      state: "healthy",
      circuit: "closed",
      failure_count: 0,
      success_count: status.success_count + 1,
      last_checked_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      cooldown_until: null,
      last_error: null,
    };

    await supabase
      .from("provider_status")
      .update(updates)
      .eq("id", status.id);
  },

  async recordFailure(
    provider: ProviderName,
    component: string = "api",
    errorMessage: string
  ): Promise<void> {
    const status = await this.get(provider, component);
    if (!status) return;

    const newFailureCount = status.failure_count + 1;
    const shouldOpenCircuit = newFailureCount >= FAILURE_THRESHOLD;
    const wasHalfOpen = status.circuit === "half_open";

    const cooldownDuration = wasHalfOpen ? EXTENDED_COOLDOWN_MS : COOLDOWN_MS;

    const updates: Partial<ProviderStatus> = {
      failure_count: newFailureCount,
      last_checked_at: new Date().toISOString(),
      last_error: errorMessage,
    };

    if (shouldOpenCircuit || wasHalfOpen) {
      updates.circuit = "open";
      updates.state = newFailureCount >= FAILURE_THRESHOLD * 2 ? "down" : "degraded";
      updates.cooldown_until = new Date(Date.now() + cooldownDuration).toISOString();

      // Log incident
      await incidentService.log(
        wasHalfOpen ? "critical" : "warn",
        `${provider}/${component}`,
        `Circuit opened: ${errorMessage}`,
        { failure_count: newFailureCount, cooldown_until: updates.cooldown_until }
      );
    }

    await supabase
      .from("provider_status")
      .update(updates)
      .eq("id", status.id);
  },

  async updateCircuit(
    provider: ProviderName,
    component: string,
    circuit: CircuitState
  ): Promise<void> {
    await supabase
      .from("provider_status")
      .update({ circuit, last_checked_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("component", component);
  },

  async updateState(
    provider: ProviderName,
    component: string,
    state: ProviderState,
    lastError?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      state,
      last_checked_at: new Date().toISOString(),
    };

    if (lastError !== undefined) {
      updates.last_error = lastError;
    }

    if (state === "healthy") {
      updates.last_success_at = new Date().toISOString();
    }

    await supabase
      .from("provider_status")
      .update(updates)
      .eq("provider", provider)
      .eq("component", component);
  },

  async resetCircuit(provider: ProviderName, component: string = "api"): Promise<void> {
    await supabase
      .from("provider_status")
      .update({
        state: "healthy",
        circuit: "closed",
        failure_count: 0,
        last_error: null,
        cooldown_until: null,
        last_checked_at: new Date().toISOString(),
      })
      .eq("provider", provider)
      .eq("component", component);
  },
};
