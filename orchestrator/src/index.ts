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
  // Build / deploy provenance — proves which commit Railway is actually running.
  const gitSha =
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.SOURCE_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.COMMIT_SHA ||
    "(unknown)";
  const gitBranch = process.env.RAILWAY_GIT_BRANCH || "(unknown)";
  const deployId =
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.RAILWAY_REPLICA_ID ||
    "(unknown)";
  const serviceName = process.env.RAILWAY_SERVICE_NAME || "(unknown)";
  const projectName = process.env.RAILWAY_PROJECT_NAME || "(unknown)";
  const apiKeyTail = config.openai.apiKey
    ? `…${config.openai.apiKey.slice(-6)} (len=${config.openai.apiKey.length})`
    : "(missing)";

  console.log(`\n🚀 Orchestrator running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Build:       commit=${gitSha} branch=${gitBranch}`);
  console.log(`   Railway:     project=${projectName} service=${serviceName} deployment=${deployId}`);
  console.log(`   Twilio:      ${config.twilio.isConfigured ? "✅ configured" : "❌ not configured"} from=${config.twilio.fromNumber || "(none)"}`);
  console.log(`   OpenAI:      ${config.openai.isConfigured ? "✅ configured" : "❌ not configured"} model=${config.openai.realtimeModel} key=${apiKeyTail}`);
  console.log(`   Supabase:    ${config.supabase.isConfigured ? "✅ configured" : "❌ not configured"} url=${config.supabase.url || "(none)"}`);
  console.log(`   PublicBase:  ${config.publicBaseUrl || "(none)"}`);
  console.log(`   PublicWS:    ${config.publicWsBaseUrl || "(none)"}`);
  console.log(`   WS path:     /twilio/stream\n`);
});
