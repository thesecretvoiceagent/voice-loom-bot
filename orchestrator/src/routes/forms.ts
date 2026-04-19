import { Router, Request, Response } from "express";
import { config } from "../config.js";
import { callEdgeFunction } from "../supabase.js";

export const formsRouter = Router();

/**
 * Builds a prefilled Google Form URL.
 *
 * @param formId  - The Google Form ID (the long alphanumeric string from the form URL)
 * @param prefillData - Map of entry field IDs (e.g. "entry_123456789") to their values
 * @returns Full prefilled URL ready to share
 */
export function buildGoogleFormUrl(
  formId: string,
  prefillData: Record<string, string>
): string {
  const base = `https://docs.google.com/forms/d/${formId}/viewform`;
  const params = new URLSearchParams({ usp: "pp_url" });

  for (const [field, value] of Object.entries(prefillData)) {
    params.append(field, value);
  }

  return `${base}?${params.toString()}`;
}

// ─── Normalization helpers ───────────────────────────────────────────────────

/** Uppercase and strip everything except alphanumeric characters. */
function normalizeRegistrationNumber(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Strip everything except a leading + and digits to produce E.164. */
function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  // Ensure we keep only one leading + (if present) followed by digits
  if (digits.startsWith("+")) {
    return "+" + digits.slice(1).replace(/\+/g, "");
  }
  return digits.replace(/\+/g, "");
}

// ─── POST /api/forms/iizi-intake ─────────────────────────────────────────────

interface IiziIntakeBody {
  secret: string;
  caseId: string;
  registrationNumber: string;
  callbackPhoneNumber: string;
  incidentDescription?: string;
  locationAddress?: string;
  [key: string]: unknown;
}

formsRouter.post(
  "/iizi-intake",
  async (req: Request<{}, {}, IiziIntakeBody>, res: Response) => {
    console.log("[Forms] POST /api/forms/iizi-intake received");

    const {
      secret,
      caseId,
      registrationNumber,
      callbackPhoneNumber,
      incidentDescription,
      locationAddress,
      ...rest
    } = req.body;

    // ── Auth ──────────────────────────────────────────────────────────────────
    const expectedSecret = config.googleFormWebhookSecret;
    if (!expectedSecret || secret !== expectedSecret) {
      console.warn("[Forms] Invalid or missing webhook secret");
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // ── Validation ────────────────────────────────────────────────────────────
    const missing: string[] = [];
    if (!caseId) missing.push("caseId");
    if (!registrationNumber) missing.push("registrationNumber");
    if (!callbackPhoneNumber) missing.push("callbackPhoneNumber");

    if (missing.length > 0) {
      console.warn(`[Forms] Missing required fields: ${missing.join(", ")}`);
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // ── Normalization ─────────────────────────────────────────────────────────
    const normalizedRegistration = normalizeRegistrationNumber(registrationNumber);
    const normalizedPhone = normalizePhoneNumber(callbackPhoneNumber);

    console.log(
      `[Forms] caseId=${caseId} | reg=${normalizedRegistration} | phone=${normalizedPhone}`
    );

    // ── Supabase upsert via edge function ─────────────────────────────────────
    const rawPayload = {
      secret: undefined, // never persist the secret
      caseId,
      registrationNumber,
      callbackPhoneNumber,
      incidentDescription,
      locationAddress,
      ...rest,
    };

    const upsertData = {
      case_id: caseId,
      registration_number: normalizedRegistration,
      callback_phone_number: normalizedPhone,
      incident_description: incidentDescription ?? null,
      location_address: locationAddress ?? null,
      raw_payload: rawPayload,
      submitted_at: new Date().toISOString(),
    };

    console.log("[Forms] Upserting to Supabase form_submissions...");

    const result = await callEdgeFunction("form-submission-write", {
      action: "upsert_form_submission",
      data: upsertData,
    });

    if (!result) {
      // Log the failure but do not return an error — the webhook must always
      // receive a 200 so Google Apps Script does not retry indefinitely.
      console.error(
        "[Forms] Supabase upsert failed or edge function unavailable; continuing anyway"
      );
    } else {
      console.log(`[Forms] Supabase upsert succeeded for caseId=${caseId}`);
    }

    return res.status(200).json({
      success: true,
      caseId,
      message: "Form submission recorded",
    });
  }
);
