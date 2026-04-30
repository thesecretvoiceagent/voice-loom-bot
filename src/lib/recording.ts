/**
 * Converts a raw Twilio recording URL to a proxied URL
 * that doesn't require Twilio authentication.
 */
export function getProxiedRecordingUrl(recordingUrl: string): string {
  if (!recordingUrl) return recordingUrl;
  
  // Only proxy Twilio URLs
  if (!recordingUrl.includes("twilio.com")) return recordingUrl;

  // Prefer explicit project id, but fall back to VITE_SUPABASE_URL
  // because some deployments only provide URL + anon key.
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  let functionsBase = "";
  if (projectId) {
    functionsBase = `https://${projectId}.supabase.co/functions/v1`;
  } else if (supabaseUrl) {
    functionsBase = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1`;
  }

  if (!functionsBase) {
    console.warn("[RecordingPlayback] Missing Supabase env for recording proxy URL");
    return recordingUrl;
  }

  return `${functionsBase}/recording-proxy?url=${encodeURIComponent(recordingUrl)}`;
}
