/**
 * Converts a raw Twilio recording URL to a proxied URL
 * that doesn't require Twilio authentication.
 */
export function getProxiedRecordingUrl(recordingUrl: string): string {
  if (!recordingUrl) return recordingUrl;
  
  // Only proxy Twilio URLs
  if (!recordingUrl.includes("twilio.com")) return recordingUrl;
  
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return recordingUrl;
  
  return `https://${projectId}.supabase.co/functions/v1/recording-proxy?url=${encodeURIComponent(recordingUrl)}`;
}
