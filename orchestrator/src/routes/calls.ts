import { Router, Request, Response } from "express";
import { config } from "../config.js";
import { upsertCall, fetchAgentConfig } from "../supabase.js";

export const callsRouter = Router();

interface StartCallBody {
  to_number: string;
  agent_id: string;
  campaign_id?: string;
  variables?: Record<string, string>;
  idempotency_key?: string;
}

callsRouter.post("/start", async (req: Request<{}, {}, StartCallBody>, res: Response) => {
  const correlationId = crypto.randomUUID();
  console.log(`[${correlationId}] POST /api/calls/start`);

  if (!config.twilio.isConfigured) {
    return res.json({
      success: false,
      status: "not_configured",
      error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.",
      correlation_id: correlationId,
    });
  }

  if (!config.openai.isConfigured) {
    return res.json({
      success: false,
      status: "not_configured",
      error: "OpenAI is not configured. Set OPENAI_API_KEY.",
      correlation_id: correlationId,
    });
  }

  const { to_number, agent_id, campaign_id, variables } = req.body;

  if (!to_number || !agent_id) {
    return res.status(400).json({
      success: false,
      status: "error",
      error: "Missing required fields: to_number, agent_id",
      correlation_id: correlationId,
    });
  }

  try {
    const callId = crypto.randomUUID();
    const variablesParam = variables && Object.keys(variables).length > 0 ? `&variables=${encodeURIComponent(JSON.stringify(variables))}` : "";
    const voiceUrl = `${config.publicBaseUrl}/twilio/voice?callId=${callId}&agentId=${agent_id}${campaign_id ? `&campaignId=${campaign_id}` : ""}${variablesParam}`;
    const statusUrl = `${config.publicBaseUrl}/twilio/status`;

    // Fetch agent settings to determine recording and ring timeout
    let enableRecording = true;
    let maxRingTime = 60;
    const agentConfig = await fetchAgentConfig(agent_id);
    if (agentConfig?.settings) {
      const s = agentConfig.settings as Record<string, unknown>;
      if (typeof s.enable_recording === "boolean") enableRecording = s.enable_recording;
      if (typeof s.max_ring_time === "number") maxRingTime = s.max_ring_time;
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Calls.json`;
    const authHeader = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString("base64");

    const params: Record<string, string> = {
      To: to_number,
      From: config.twilio.fromNumber,
      Url: voiceUrl,
      StatusCallback: statusUrl,
      StatusCallbackEvent: "initiated ringing answered completed",
      StatusCallbackMethod: "POST",
      Timeout: String(maxRingTime),
    };

    if (enableRecording) {
      params.Record = "true";
      params.RecordingStatusCallback = `${config.publicBaseUrl}/twilio/recording-status`;
      params.RecordingStatusCallbackMethod = "POST";
    }

    const formBody = new URLSearchParams(params);

    console.log(`[${correlationId}] Calling Twilio: ${to_number} from ${config.twilio.fromNumber}`);

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error(`[${correlationId}] Twilio error:`, twilioData);
      return res.json({
        success: false,
        status: "error",
        error: twilioData.message || "Twilio API error",
        correlation_id: correlationId,
      });
    }

    console.log(`[${correlationId}] Call started: SID=${twilioData.sid}, callId=${callId}`);

    return res.json({
      success: true,
      status: "started",
      call_id: callId,
      twilio_call_sid: twilioData.sid,
      correlation_id: correlationId,
    });
  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return res.status(500).json({
      success: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      correlation_id: correlationId,
    });
  }
});
