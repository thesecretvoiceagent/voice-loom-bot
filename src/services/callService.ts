/**
 * Call Service
 * 
 * Provides unified interface for call operations.
 * - Call ACTIONS (start, etc.) go through EXTERNAL ORCHESTRATOR
 * - Call DATA reads from SUPABASE (source of truth)
 * 
 * UI never calls Twilio or OpenAI directly.
 */

import { supabase } from "@/integrations/supabase/client";
import { orchestratorClient } from "./orchestratorClient";
import type { Call, CallEvent, StartCallRequest, StartCallResponse } from "@/types/call";

class CallServiceClient {
  /**
   * Start a new outbound call via EXTERNAL ORCHESTRATOR
   */
  async startCall(request: StartCallRequest): Promise<StartCallResponse> {
    return orchestratorClient.startCall(request);
  }

  /**
   * Get a call by ID from SUPABASE (read-only)
   * Note: calls table must exist and be populated by orchestrator
   */
  async getCall(callId: string): Promise<Call | null> {
    try {
      const { data, error } = await supabase
        .from('calls' as any)
        .select('*')
        .eq('id', callId)
        .maybeSingle();

      if (error) {
        console.error('Failed to get call:', error);
        return null;
      }

      return data as unknown as Call | null;
    } catch (err) {
      console.error('Call query failed:', err);
      return null;
    }
  }

  /**
   * Get calls with filters from SUPABASE (read-only)
   */
  async getCalls(filters?: {
    status?: string;
    campaign_id?: string;
    agent_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Call[]> {
    try {
      let query = supabase
        .from('calls' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.campaign_id) {
        query = query.eq('campaign_id', filters.campaign_id);
      }
      if (filters?.agent_id) {
        query = query.eq('agent_id', filters.agent_id);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get calls:', error);
        return [];
      }

      return (data as unknown as Call[]) || [];
    } catch (err) {
      console.error('Calls query failed:', err);
      return [];
    }
  }

  /**
   * Get call events for a call from SUPABASE (read-only)
   */
  async getCallEvents(callId: string): Promise<CallEvent[]> {
    try {
      const { data, error } = await supabase
        .from('call_events' as any)
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to get call events:', error);
        return [];
      }

      return (data as unknown as CallEvent[]) || [];
    } catch (err) {
      console.error('Call events query failed:', err);
      return [];
    }
  }
}

export const callService = new CallServiceClient();
