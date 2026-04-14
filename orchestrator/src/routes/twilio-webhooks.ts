import { Router, Request, Response } from "express";
import { config } from "../config.js";

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

  console.log(`[${correlationId}] POST /twilio/voice callId=${callId} agentId=${agentId} campaignId=${campaignId}`);
  console.log(`[${correlationId}] CallSid=${req.body?.CallSid} From=${req.body?.From} To=${req.body?.To}`);

  if (!config.openai.isConfigured) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">This voice service is not yet configured. Please try again later.</Say>
  <Hangup/>
</Response>`;
    return res.type("text/xml").send(twiml);
  }

  // Build WebSocket URL for Media Stream
  const wsBase = config.publicWsBaseUrl || config.publicBaseUrl.replace("https://", "wss://");
  const streamUrl = `${wsBase}/twilio/stream`;

  // No <Say> before <Connect> — the AI agent will speak its own greeting
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callId" value="${callId}"/>
      <Parameter name="agentId" value="${agentId}"/>
      <Parameter name="campaignId" value="${campaignId}"/>
      <Parameter name="callSid" value="${req.body?.CallSid || ""}"/>
    </Stream>
  </Connect>
</Response>`;

  console.log(`[${correlationId}] Returning TwiML with stream → ${streamUrl}`);
  return res.type("text/xml").send(twiml);
});

/**
 * POST /twilio/status — Twilio status callback
 */
twilioWebhookRouter.post("/status", (req: Request, res: Response) => {
  const correlationId = crypto.randomUUID();

  console.log(`[${correlationId}] POST /twilio/status`, {
    CallSid: req.body?.CallSid,
    CallStatus: req.body?.CallStatus,
    CallDuration: req.body?.CallDuration,
  });

  // TODO: Write call status to Supabase when calls table exists

  return res.json({ ok: true, correlation_id: correlationId });
});
