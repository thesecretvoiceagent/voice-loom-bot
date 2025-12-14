/**
 * Twilio Service Wrapper
 * 
 * All Twilio operations go through the EXTERNAL ORCHESTRATOR (Railway).
 * UI NEVER calls Twilio directly.
 * 
 * This wrapper calls the orchestrator's endpoints.
 */

import { orchestratorClient } from "./orchestratorClient";
import type { StartCallRequest, StartCallResponse, CallEvent } from "@/types/call";

export interface TwilioServiceConfig {
  isConfigured: boolean;
}

class TwilioServiceClient {
  /**
   * Check if Twilio is configured via orchestrator
   */
  async checkConfiguration(): Promise<TwilioServiceConfig> {
    const health = await orchestratorClient.health();
    return {
      isConfigured: health.providers?.twilio?.configured ?? false
    };
  }

  /**
   * Start an outbound call via orchestrator
   */
  async startCall(request: StartCallRequest): Promise<StartCallResponse> {
    return orchestratorClient.startCall(request);
  }

  /**
   * Parse Twilio status callback payload (for reference - actual parsing happens in orchestrator)
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
