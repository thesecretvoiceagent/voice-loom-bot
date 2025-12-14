/**
 * OpenAI Realtime Service Wrapper
 * 
 * This service provides a clean interface for OpenAI Realtime API operations.
 * All actual OpenAI API calls happen in edge functions (server-side only).
 * This client-side wrapper manages WebSocket connections and state.
 */

import { supabase } from "@/integrations/supabase/client";

export interface OpenAIRealtimeConfig {
  isConfigured: boolean;
  model?: string;
  voice?: string;
}

export interface RealtimeSession {
  sessionId: string;
  ephemeralKey: string;
  expiresAt: string;
}

export interface RealtimeConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'not_configured';
  error?: string;
}

class OpenAIRealtimeServiceClient {
  private config: OpenAIRealtimeConfig = { isConfigured: false };
  private session: RealtimeSession | null = null;
  private ws: WebSocket | null = null;
  private connectionState: RealtimeConnectionState = { status: 'disconnected' };

  /**
   * Check if OpenAI Realtime is configured (has required env vars on server)
   */
  async checkConfiguration(): Promise<OpenAIRealtimeConfig> {
    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-status', {
        body: { action: 'check_config' }
      });

      if (error) {
        console.warn('OpenAI Realtime configuration check failed:', error);
        this.config = { isConfigured: false };
      } else {
        this.config = {
          isConfigured: data?.configured ?? false,
          model: data?.model,
          voice: data?.voice
        };
      }
    } catch (err) {
      console.warn('OpenAI Realtime service not available:', err);
      this.config = { isConfigured: false };
    }

    return this.config;
  }

  /**
   * Create a new realtime session via edge function
   */
  async createSession(options?: {
    voice?: string;
    instructions?: string;
  }): Promise<{ success: boolean; session?: RealtimeSession; error?: string }> {
    if (!this.config.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.config.isConfigured) {
      return {
        success: false,
        error: 'OpenAI Realtime is not configured. Add OPENAI_API_KEY to secrets.'
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('openai-realtime-session', {
        body: {
          voice: options?.voice || 'alloy',
          instructions: options?.instructions
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      this.session = {
        sessionId: data.id,
        ephemeralKey: data.client_secret?.value,
        expiresAt: data.expires_at
      };

      return { success: true, session: this.session };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Connect to OpenAI Realtime WebSocket using ephemeral key
   */
  async connectWebSocket(options?: {
    onMessage?: (event: MessageEvent) => void;
    onError?: (error: Event) => void;
    onClose?: () => void;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.session?.ephemeralKey) {
      return { success: false, error: 'No active session. Call createSession first.' };
    }

    try {
      this.connectionState = { status: 'connecting' };
      
      const wsUrl = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
      
      this.ws = new WebSocket(wsUrl, [
        'realtime',
        `openai-insecure-api-key.${this.session.ephemeralKey}`,
        'openai-beta.realtime-v1'
      ]);

      return new Promise((resolve) => {
        if (!this.ws) {
          resolve({ success: false, error: 'WebSocket creation failed' });
          return;
        }

        this.ws.onopen = () => {
          this.connectionState = { status: 'connected' };
          resolve({ success: true });
        };

        this.ws.onmessage = (event) => {
          options?.onMessage?.(event);
        };

        this.ws.onerror = (error) => {
          this.connectionState = { status: 'error', error: 'WebSocket error' };
          options?.onError?.(error);
        };

        this.ws.onclose = () => {
          this.connectionState = { status: 'disconnected' };
          this.ws = null;
          options?.onClose?.();
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (this.connectionState.status === 'connecting') {
            this.close();
            resolve({ success: false, error: 'Connection timeout' });
          }
        }, 10000);
      });
    } catch (err) {
      this.connectionState = { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
      return { success: false, error: this.connectionState.error };
    }
  }

  /**
   * Send a message through the WebSocket
   */
  send(message: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return false;
    }

    this.ws.send(JSON.stringify(message));
    return true;
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.session = null;
    this.connectionState = { status: 'disconnected' };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): RealtimeConnectionState {
    if (!this.config.isConfigured) {
      return { status: 'not_configured' };
    }
    return this.connectionState;
  }

  /**
   * Get current session
   */
  getSession(): RealtimeSession | null {
    return this.session;
  }
}

export const openaiRealtimeService = new OpenAIRealtimeServiceClient();
