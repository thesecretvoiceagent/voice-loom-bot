// Shared call types - used by frontend and edge functions

export interface Call {
  id: string;
  to_number: string;
  from_number?: string;
  status: CallStatus;
  direction: 'inbound' | 'outbound';
  twilio_call_sid?: string;
  agent_id?: string;
  campaign_id?: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  recording_url?: string;
  transcription?: string;
  outcome?: string;
  created_at: string;
  updated_at: string;
}

export type CallStatus = 
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

export interface CallEvent {
  id: string;
  call_id: string;
  type: CallEventType;
  payload: Record<string, unknown>;
  timestamp: string;
  created_at: string;
}

export type CallEventType =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'failed'
  | 'recording_started'
  | 'recording_completed'
  | 'transcription_ready'
  | 'ai_response'
  | 'dtmf_received'
  | 'transferred';

export interface StartCallRequest {
  to_number: string;
  agent_id: string;
  campaign_id?: string;
  variables?: Record<string, string>;
  idempotency_key?: string;
}

export interface StartCallResponse {
  success: boolean;
  call_id?: string;
  twilio_call_sid?: string;
  error?: string;
  status: 'started' | 'not_configured' | 'error';
}

export interface HealthCheck {
  provider: ProviderName;
  component: string;
  status: 'healthy' | 'degraded' | 'down' | 'not_configured';
  last_ok_at?: string;
  last_error?: string;
  updated_at: string;
}

export type ProviderName = 
  | 'supabase'
  | 'twilio'
  | 'openai'
  | 'gemini'
  | 'vercel_runtime'
  | 'railway_workers';

export interface HealthCheckRunResponse {
  success: boolean;
  results: HealthCheck[];
  status: 'completed' | 'not_configured' | 'error';
  correlation_id: string;
}
