import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "",
    get isConfigured() {
      return !!(this.accountSid && this.authToken && this.fromNumber);
    },
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    realtimeModel: "gpt-4o-realtime-preview-2024-12-17",
    get isConfigured() {
      return !!this.apiKey;
    },
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    get isConfigured() {
      return !!(this.url && this.serviceRoleKey);
    },
  },

  // Public URLs
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
  publicWsBaseUrl: process.env.PUBLIC_WS_BASE_URL || "",
};
