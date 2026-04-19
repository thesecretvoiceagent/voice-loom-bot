import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { callsRouter } from "./routes/calls.js";
import { twilioWebhookRouter } from "./routes/twilio-webhooks.js";
import { locationRouter } from "./routes/location.js";
import { formsRouter } from "./routes/forms.js";
import { handleTwilioMediaStream } from "./ws/media-stream.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/", healthRouter);
app.use("/api/calls", callsRouter);
app.use("/api/location", locationRouter);
app.use("/api/forms", formsRouter);
app.use("/twilio", twilioWebhookRouter);

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ server, path: "/twilio/stream" });

wss.on("connection", (ws, req) => {
  console.log(`[WS] New Twilio Media Stream connection from ${req.socket.remoteAddress}`);
  handleTwilioMediaStream(ws);
});

wss.on("error", (err) => {
  console.error("[WS] WebSocket server error:", err);
});

server.listen(config.port, () => {
  console.log(`\n🚀 Orchestrator running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Twilio:      ${config.twilio.isConfigured ? "✅ configured" : "❌ not configured"}`);
  console.log(`   OpenAI:      ${config.openai.isConfigured ? "✅ configured" : "❌ not configured"}`);
  console.log(`   Supabase:    ${config.supabase.isConfigured ? "✅ configured" : "❌ not configured"}`);
  console.log(`   WS path:     /twilio/stream\n`);
});
