import { supabase } from "@/integrations/supabase/client";

export interface IdempotencyKey {
  key: string;
  namespace: string;
  created_at: string;
  expires_at: string | null;
  payload_hash: string | null;
}

export const idempotencyService = {
  /**
   * Check if an operation has already been processed
   * Returns true if the key exists (already processed)
   */
  async exists(key: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("idempotency_keys")
      .select("key")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error("Failed to check idempotency key:", error);
      return false; // Fail open to allow processing
    }

    return !!data;
  },

  /**
   * Create an idempotency key to mark an operation as processed
   * Returns true if created, false if already exists
   */
  async create(
    key: string,
    namespace: string,
    payloadHash?: string,
    expiresInMs?: number
  ): Promise<boolean> {
    const expiresAt = expiresInMs
      ? new Date(Date.now() + expiresInMs).toISOString()
      : null;

    const { error } = await supabase
      .from("idempotency_keys")
      .insert({
        key,
        namespace,
        payload_hash: payloadHash ?? null,
        expires_at: expiresAt,
      });

    if (error) {
      // Unique constraint violation means key already exists
      if (error.code === "23505") {
        return false;
      }
      console.error("Failed to create idempotency key:", error);
      return false;
    }

    return true;
  },

  /**
   * Atomic check-and-set: returns true if we should process, false if already processed
   */
  async checkAndSet(
    key: string,
    namespace: string,
    payloadHash?: string,
    expiresInMs: number = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<boolean> {
    // Try to insert - if successful, we should process
    return await this.create(key, namespace, payloadHash, expiresInMs);
  },

  /**
   * Generate a deterministic key for Twilio webhooks
   */
  generateTwilioKey(eventType: string, callSid: string, timestamp?: string): string {
    const ts = timestamp || Date.now().toString();
    return `twilio:${eventType}:${callSid}:${ts}`;
  },

  /**
   * Generate a deterministic key for SMS sending
   */
  generateSmsKey(callId: string, templateId: string): string {
    return `sms:${callId}:${templateId}`;
  },

  /**
   * Generate a deterministic key for worker jobs
   */
  generateJobKey(campaignId: string, debtorId: string, attempt: number): string {
    return `job:${campaignId}:${debtorId}:${attempt}`;
  },

  /**
   * Clean up expired keys (can be run periodically)
   */
  async cleanupExpired(): Promise<number> {
    const { data, error } = await supabase
      .from("idempotency_keys")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("key");

    if (error) {
      console.error("Failed to cleanup expired idempotency keys:", error);
      return 0;
    }

    return data?.length || 0;
  },
};
