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
  // Detect inbound vs outbound: outbound calls include callId in query (set by /api/calls/start)
  const isInbound = !req.query.callId;
  const callId = (req.query.callId as string) || crypto.randomUUID();
  const agentId = (req.query.agentId as string) || "";
  const campaignId = (req.query.campaignId as string) || "";
  const variables = (req.query.variables as string) || "";
  const direction = isInbound ? "inbound" : "outbound";

  console.log(`[${correlationId}] POST /twilio/voice direction=${direction} callId=${callId} agentId=${agentId || "(resolve-by-number)"} campaignId=${campaignId} variables=${variables ? 'yes' : 'no'}`);
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
  const fromNumber = req.body?.From || "";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callId" value="${callId}"/>
      <Parameter name="agentId" value="${agentId}"/>
      <Parameter name="campaignId" value="${campaignId}"/>
      <Parameter name="callSid" value="${req.body?.CallSid || ""}"/>
      <Parameter name="calledNumber" value="${calledNumber}"/>
      <Parameter name="fromNumber" value="${fromNumber}"/>
      <Parameter name="direction" value="${direction}"/>
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
 * POST /twilio/sms-status — Twilio SMS status callback
 * Receives delivery status updates for outbound SMS messages.
 * Logs the full payload so Railway deploy logs can be used to diagnose
 * SMS delivery failures (e.g. Twilio error 30453 carrier/fraud blocks).
 */
twilioWebhookRouter.post("/sms-status", async (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  // Pull every field Twilio may send on an SMS status callback
  const {
    MessageSid,
    SmsSid,
    MessageStatus,
    SmsStatus,
    ErrorCode,
    ErrorMessage,
    To,
    From,
    Body,
    NumSegments,
    NumMedia,
    AccountSid,
    ApiVersion,
    ChannelPrefix,
    ChannelInstallSid,
    RawDlrDoneDate,
  } = req.body || {};

  const sid = MessageSid || SmsSid || "(no-sid)";
  const status = MessageStatus || SmsStatus || "(no-status)";

  console.log(`[TwilioSmsCallback] ──────────────────────────────────────────`);
  console.log(`[TwilioSmsCallback] POST /twilio/sms-status received at ${receivedAt}`);
  console.log(`[TwilioSmsCallback] correlationId=${correlationId}`);
  console.log(`[TwilioSmsCallback] MessageSid=${sid}  Status=${status}`);
  console.log(`[TwilioSmsCallback] To=${To || "(none)"}  From=${From || "(none)"}`);

  if (ErrorCode || ErrorMessage) {
    console.error(`[TwilioSmsCallback] ⚠ ERROR  ErrorCode=${ErrorCode || "(none)"}  ErrorMessage=${ErrorMessage || "(none)"}`);
  } else {
    console.log(`[TwilioSmsCallback] ErrorCode=(none)  ErrorMessage=(none)`);
  }

  console.log(`[TwilioSmsCallback] Full body:`, JSON.stringify({
    MessageSid,
    SmsSid,
    MessageStatus,
    SmsStatus,
    ErrorCode,
    ErrorMessage,
    To,
    From,
    Body: Body ? `${String(Body).slice(0, 80)}${String(Body).length > 80 ? "…" : ""}` : undefined,
    NumSegments,
    NumMedia,
    AccountSid,
    ApiVersion,
    ChannelPrefix,
    ChannelInstallSid,
    RawDlrDoneDate,
  }));

  const responsePayload = { ok: true, correlation_id: correlationId };
  console.log(`[TwilioSmsCallback] Responding 200 OK  correlation_id=${correlationId}`);
  console.log(`[TwilioSmsCallback] ──────────────────────────────────────────`);

  return res.status(200).json(responsePayload);
});

/**
 * POST /twilio/sms-fallback — Twilio SMS fallback handler
 * Called by Twilio when the primary SMS webhook URL fails or returns an error.
 * Logs the full payload for debugging; always returns 200 so Twilio stops retrying.
 */
twilioWebhookRouter.post("/sms-fallback", async (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  const {
    MessageSid,
    SmsSid,
    MessageStatus,
    SmsStatus,
    ErrorCode,
    ErrorMessage,
    To,
    From,
    Body,
    NumSegments,
    NumMedia,
    AccountSid,
    ApiVersion,
  } = req.body || {};

  const sid = MessageSid || SmsSid || "(no-sid)";
  const status = MessageStatus || SmsStatus || "(no-status)";

  console.log(`[TwilioSmsFallback] ──────────────────────────────────────────`);
  console.log(`[TwilioSmsFallback] POST /twilio/sms-fallback received at ${receivedAt}`);
  console.log(`[TwilioSmsFallback] correlationId=${correlationId}`);
  console.log(`[TwilioSmsFallback] MessageSid=${sid}  Status=${status}`);
  console.log(`[TwilioSmsFallback] To=${To || "(none)"}  From=${From || "(none)"}`);

  if (ErrorCode || ErrorMessage) {
    console.error(`[TwilioSmsFallback] ⚠ ERROR  ErrorCode=${ErrorCode || "(none)"}  ErrorMessage=${ErrorMessage || "(none)"}`);
  } else {
    console.log(`[TwilioSmsFallback] ErrorCode=(none)  ErrorMessage=(none)`);
  }

  console.log(`[TwilioSmsFallback] Full body:`, JSON.stringify({
    MessageSid,
    SmsSid,
    MessageStatus,
    SmsStatus,
    ErrorCode,
    ErrorMessage,
    To,
    From,
    Body: Body ? `${String(Body).slice(0, 80)}${String(Body).length > 80 ? "…" : ""}` : undefined,
    NumSegments,
    NumMedia,
    AccountSid,
    ApiVersion,
  }));

  const responsePayload = { ok: true, correlation_id: correlationId };
  console.log(`[TwilioSmsFallback] Responding 200 OK  correlation_id=${correlationId}`);
  console.log(`[TwilioSmsFallback] ──────────────────────────────────────────`);

  return res.status(200).json(responsePayload);
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
