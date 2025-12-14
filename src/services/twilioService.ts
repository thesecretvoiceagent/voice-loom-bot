/**
 * Twilio Service Wrapper
 * 
 * This service provides a clean interface for Twilio operations.
 * All actual Twilio API calls happen in edge functions (server-side only).
 * This client-side wrapper calls those edge functions.
 */

import { supabase } from "@/integrations/supabase/client";
import type { StartCallRequest, StartCallResponse, CallEvent } from "@/types/call";

export interface TwilioServiceConfig {
  isConfigured: boolean;
}

class TwilioServiceClient {
  private config: TwilioServiceConfig = { isConfigured: false };

  /**
   * Check if Twilio is configured (has required env vars on server)
   */
  async checkConfiguration(): Promise<TwilioServiceConfig> {
    try {
      const { data, error } = await supabase.functions.invoke('twilio-status', {
        body: { action: 'check_config' }
      });

      if (error) {
        console.warn('Twilio configuration check failed:', error);
        this.config = { isConfigured: false };
      } else {
        this.config = { isConfigured: data?.configured ?? false };
      }
    } catch (err) {
      console.warn('Twilio service not available:', err);
      this.config = { isConfigured: false };
    }

    return this.config;
  }

  /**
   * Start an outbound call via edge function
   */
  async startCall(request: StartCallRequest): Promise<StartCallResponse> {
    if (!this.config.isConfigured) {
      await this.checkConfiguration();
    }

    if (!this.config.isConfigured) {
      return {
        success: false,
        status: 'not_configured',
        error: 'Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to secrets.'
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('calls-start', {
        body: request
      });

      if (error) {
        return {
          success: false,
          status: 'error',
          error: error.message
        };
      }

      return data as StartCallResponse;
    } catch (err) {
      return {
        success: false,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse Twilio status callback payload
   */
  parseStatusCallback(payload: Record<string, unknown>): Partial<CallEvent> {
    return {
      type: this.mapTwilioStatus(payload.CallStatus as string),
      payload: {
        call_sid: payload.CallSid,
        call_status: payload.CallStatus,
        call_duration: payload.CallDuration,
        from: payload.From,
        to: payload.To,
        direction: payload.Direction,
        timestamp: new Date().toISOString()
      }
    };
  }

  private mapTwilioStatus(status: string): CallEvent['type'] {
    const statusMap: Record<string, CallEvent['type']> = {
      'initiated': 'initiated',
      'ringing': 'ringing',
      'in-progress': 'answered',
      'completed': 'completed',
      'busy': 'failed',
      'failed': 'failed',
      'no-answer': 'failed',
      'canceled': 'failed'
    };
    return statusMap[status] || 'initiated';
  }
}

export const twilioService = new TwilioServiceClient();
