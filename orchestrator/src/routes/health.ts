import { Router } from "express";
import { config } from "../config.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "orchestrator",
    version: "1.0.0",
    uptime: process.uptime(),
    providers: {
      twilio: {
        configured: config.twilio.isConfigured,
        status: config.twilio.isConfigured ? "READY" : "NOT_CONFIGURED",
      },
      openai: {
        configured: config.openai.isConfigured,
        status: config.openai.isConfigured ? "READY" : "NOT_CONFIGURED",
      },
      supabase: {
        configured: config.supabase.isConfigured,
        status: config.supabase.isConfigured ? "READY" : "NOT_CONFIGURED",
      },
    },
  });
});
