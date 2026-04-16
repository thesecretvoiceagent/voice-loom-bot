import { Router, Request, Response } from "express";
import { config } from "../config.js";
import { updateCallBySid } from "../supabase.js";

export const twilioWebhookRouter = Router();

/**
 * POST /twilio/voice — Twilio voice webhook
 * Returns TwiML that opens a bidirectional Media Stream to /twilio/stream
 */
twilioWebhookRouter.post("/voice", (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();
  const callId = (req.query.callId as string) || crypto.randomUUID();
  const agentId = (req.query.agentId as string) || "default";
  const campaignId = (req.query.campaignId as string) || "";
  const variables = (req.query.variables as string) || "";

  console.log(`[${correlationId}] POST /twilio/voice callId=${callId} agentId=${agentId} campaignId=${campaignId} variables=${variables ? 'yes' : 'no'}`);
  console.log(`[${correlationId}] CallSid=${req.body?.CallSid} From=${req.body?.From} To=${req.body?.To}`);

  if (!config.openai.isConfigured) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This voice service is not yet configured. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return res.type("text/xml").send(twiml);
  }

  const wsBase = config.publicWsBaseUrl || config.publicBaseUrl.replace("https://", "wss://");
  const streamUrl = `${wsBase}/twilio/stream`;
  const calledNumber = req.body?.To || "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callId" value="${callId}"/>
      <Parameter name="agentId" value="${agentId}"/>
      <Parameter name="campaignId" value="${campaignId}"/>
      <Parameter name="callSid" value="${req.body?.CallSid || ""}"/>
      <Parameter name="calledNumber" value="${calledNumber}"/>
      <Parameter name="variables" value="${variables.replace(/"/g, '&quot;')}"/>
    </Stream>
  </Connect>
</Response>`;

  console.log(`[${correlationId}] Returning TwiML with stream → ${streamUrl}`);
  return res.type("text/xml").send(twiml);
});

/**
 * POST /twilio/status — Twilio status callback
 */
twilioWebhookRouter.post("/status", async (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();
  const { CallSid, CallStatus, CallDuration } = req.body || {};

  console.log(`[${correlationId}] POST /twilio/status`, { CallSid, CallStatus, CallDuration });

  if (CallSid && CallStatus) {
    const statusMap: Record<string, string> = {
      initiated: "initiated",
      ringing: "ringing",
      "in-progress": "in-progress",
      completed: "completed",
      busy: "busy",
      "no-answer": "no-answer",
      canceled: "canceled",
      failed: "failed",
    };

    const data: Record<string, unknown> = {
      status: statusMap[CallStatus] || CallStatus,
    };

    if (CallStatus === "answered" || CallStatus === "in-progress") {
      data.answered_at = new Date().toISOString();
    }

    if (CallStatus === "completed") {
      data.ended_at = new Date().toISOString();
      if (CallDuration) {
        data.duration_seconds = parseInt(CallDuration, 10);
      }
    }

    await updateCallBySid(CallSid, data);
  }

  return res.json({ ok: true, correlation_id: correlationId });
});

/**
 * POST /twilio/recording-status — Twilio recording status callback
 * Saves recording URL to the call record
 */
twilioWebhookRouter.post("/recording-status", async (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();
  const { CallSid, RecordingUrl, RecordingStatus, RecordingDuration } = req.body || {};

  console.log(`[${correlationId}] POST /twilio/recording-status`, {
    CallSid,
    RecordingStatus,
    RecordingDuration,
    RecordingUrl,
  });

  if (CallSid && RecordingUrl && RecordingStatus === "completed") {
    // Twilio recording URL needs .mp3 or .wav extension for playback
    const recordingUrlMp3 = `${RecordingUrl}.mp3`;
    await updateCallBySid(CallSid, {
      recording_url: recordingUrlMp3,
    });
    console.log(`[${correlationId}] Recording saved for CallSid=${CallSid}: ${recordingUrlMp3}`);
  }

  return res.json({ ok: true, correlation_id: correlationId });
});
