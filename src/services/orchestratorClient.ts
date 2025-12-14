/**
 * External Orchestrator API Client
 * 
 * All calls to Twilio, OpenAI Realtime, and voice bridging go through
 * the external orchestrator service (deployed on Railway).
 * 
 * UI NEVER calls Twilio or OpenAI directly.
 */

const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    console.warn('VITE_API_BASE_URL not configured - orchestrator calls will fail');
    return '';
  }
  return baseUrl.replace(/\/$/, ''); // Remove trailing slash
};

export interface OrchestratorConfig {
  isConfigured: boolean;
  baseUrl: string;
}

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
  correlation_id?: string;
}

export interface OrchestratorHealthResponse {
  ok: boolean;
  service: string;
  version?: string;
  providers?: {
    twilio?: { configured: boolean; status: string };
    openai?: { configured: boolean; status: string };
    supabase?: { configured: boolean; status: string };
  };
}

class OrchestratorClient {
  private baseUrl: string = '';

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Check if orchestrator is configured
   */
  getConfig(): OrchestratorConfig {
    return {
      isConfigured: !!this.baseUrl,
      baseUrl: this.baseUrl
    };
  }

  /**
   * Refresh base URL (useful after env changes)
   */
  refresh(): void {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Health check - GET /health
   */
  async health(): Promise<OrchestratorHealthResponse> {
    if (!this.baseUrl) {
      return {
        ok: false,
        service: 'orchestrator',
        providers: {
          twilio: { configured: false, status: 'NOT_CONFIGURED' },
          openai: { configured: false, status: 'NOT_CONFIGURED' },
          supabase: { configured: false, status: 'NOT_CONFIGURED' }
        }
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Orchestrator health check failed:', error);
      return {
        ok: false,
        service: 'orchestrator'
      };
    }
  }

  /**
   * Start a call - POST /api/calls/start
   */
  async startCall(request: StartCallRequest): Promise<StartCallResponse> {
    if (!this.baseUrl) {
      return {
        success: false,
        status: 'not_configured',
        error: 'VITE_API_BASE_URL not configured. Set this to your Railway orchestrator URL.'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: 'error',
          error: data.error || `HTTP ${response.status}`,
          correlation_id: data.correlation_id
        };
      }

      return data;
    } catch (error) {
      console.error('Start call failed:', error);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Run health checks - POST /ops/health/run
   */
  async runHealthChecks(): Promise<{
    success: boolean;
    results?: Array<{
      provider: string;
      component: string;
      status: string;
      last_ok_at?: string;
      last_error?: string;
    }>;
    error?: string;
    correlation_id?: string;
  }> {
    if (!this.baseUrl) {
      return {
        success: false,
        error: 'VITE_API_BASE_URL not configured'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/ops/health/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      return await response.json();
    } catch (error) {
      console.error('Health check run failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }
}

export const orchestratorClient = new OrchestratorClient();
