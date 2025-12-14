import { supabase } from "@/integrations/supabase/client";
import { featureFlagService } from "./featureFlagService";
import { circuitBreakerService } from "./circuitBreakerService";
import { incidentService } from "./incidentService";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  provider: "openai" | "gemini" | "fallback";
  model?: string;
  error?: string;
}

const FALLBACK_RESPONSE = "I'm unable to complete this step right now. Please try again later.";

export const aiOrchestratorService = {
  /**
   * Main entry point for AI completions with automatic failover
   */
  async complete(
    messages: AIMessage[],
    options?: {
      preferredProvider?: "openai" | "gemini";
      maxRetries?: number;
      timeout?: number;
    }
  ): Promise<AIResponse> {
    // Check master AI switch
    const aiEnabled = await featureFlagService.isEnabled("ai.enabled", true);
    if (!aiEnabled) {
      return {
        content: FALLBACK_RESPONSE,
        provider: "fallback",
        error: "AI is disabled",
      };
    }

    const preferredProvider =
      options?.preferredProvider ||
      (await featureFlagService.getValue("ai.provider.preferred")) as "openai" | "gemini" ||
      "gemini";

    const maxRetries = options?.maxRetries ?? 1;

    // Try preferred provider first
    const providers = this.getProviderOrder(preferredProvider);

    for (const provider of providers) {
      const isEnabled = await this.isProviderEnabled(provider);
      if (!isEnabled) continue;

      const isOpen = await circuitBreakerService.isCircuitOpen(provider, "api");
      if (isOpen) {
        console.log(`Circuit open for ${provider}, skipping`);
        continue;
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await this.callProvider(provider, messages, options?.timeout);
          await circuitBreakerService.recordSuccess(provider, "api");
          return response;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`${provider} attempt ${attempt + 1} failed:`, errorMessage);

          if (attempt === maxRetries) {
            await circuitBreakerService.recordFailure(provider, "api", errorMessage);
          }
        }
      }
    }

    // All providers failed
    await incidentService.log(
      "critical",
      "ai/orchestrator",
      "All AI providers failed, returning fallback response",
      { messages_count: messages.length }
    );

    return {
      content: FALLBACK_RESPONSE,
      provider: "fallback",
      error: "All providers failed",
    };
  },

  getProviderOrder(preferred: "openai" | "gemini"): ("openai" | "gemini")[] {
    return preferred === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
  },

  async isProviderEnabled(provider: "openai" | "gemini"): Promise<boolean> {
    const flagKey = provider === "openai" ? "ai.openai.enabled" : "ai.gemini.enabled";
    return await featureFlagService.isEnabled(flagKey, true);
  },

  async callProvider(
    provider: "openai" | "gemini",
    messages: AIMessage[],
    timeout?: number
  ): Promise<AIResponse> {
    const model = provider === "openai" ? "openai/gpt-5-mini" : "google/gemini-2.5-flash";

    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const { data, error } = await supabase.functions.invoke("ai-completion", {
        body: { messages, model, provider },
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (error) {
        throw new Error(error.message || "Edge function error");
      }

      if (!data?.content) {
        throw new Error("No content in response");
      }

      return {
        content: data.content,
        provider,
        model,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  },

  /**
   * Check if voice features are available
   */
  async isVoiceAvailable(): Promise<boolean> {
    const voiceEnabled = await featureFlagService.isEnabled("ai.gemini.voice.enabled", true);
    if (!voiceEnabled) return false;

    const isOpen = await circuitBreakerService.isCircuitOpen("gemini", "voice");
    return !isOpen;
  },

  /**
   * Get current AI status for UI display
   */
  async getStatus(): Promise<{
    aiEnabled: boolean;
    preferredProvider: string;
    openaiEnabled: boolean;
    geminiEnabled: boolean;
    voiceEnabled: boolean;
  }> {
    const [aiEnabled, preferredProvider, openaiEnabled, geminiEnabled, voiceEnabled] =
      await Promise.all([
        featureFlagService.isEnabled("ai.enabled", true),
        featureFlagService.getValue("ai.provider.preferred"),
        featureFlagService.isEnabled("ai.openai.enabled", true),
        featureFlagService.isEnabled("ai.gemini.enabled", true),
        featureFlagService.isEnabled("ai.gemini.voice.enabled", true),
      ]);

    return {
      aiEnabled,
      preferredProvider: preferredProvider || "gemini",
      openaiEnabled,
      geminiEnabled,
      voiceEnabled,
    };
  },
};
