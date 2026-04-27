// Public endpoint — called from a static-ish form submission page opened from
// an SMS link during a live call. THIN by design:
//   1. validate input (caseId UUID + HMAC token + reg_no + phone)
//   2. verify HMAC token (must match LOCATION_TOKEN_SECRET — same shared secret
//      we already use for the location page, so we don't need a second secret)
//   3. UPDATE the calls row with form_registration_number / form_callback_phone_number
//   4. return { ok }
//
// Orchestrator (orchestrator/src/ws/media-stream.ts) listens to the calls UPDATE
// via realtime. When form_submitted_at changes, it injects the values into the
// live OpenAI Realtime session so the AI reads them back to the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Estonian plates are 3 digits + 3 letters (e.g. 484DLC), but accept anything
// alphanumeric 3-10 chars to allow custom plates / foreign plates / spaces.
const REG_NO_RE = /^[A-Z0-9 \-]{2,12}$/i;

// Loose E.164-ish phone validation. Allow +, digits, spaces, dashes, parens.
const PHONE_RE = /^[+0-9 ()\-]{6,20}$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifyToken(caseId: string, token: string): Promise<boolean> {
  const secret = Deno.env.get("LOCATION_TOKEN_SECRET") || "";
  if (!secret) {
    console.warn("[form-submit] LOCATION_TOKEN_SECRET not set — rejecting");
    return false;
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(caseId));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeHexEqual(token.toLowerCase(), expected.toLowerCase());
}

function normalizeRegNo(raw: string): string {
  return raw.replace(/[\s\-]/g, "").toUpperCase();
}

function normalizePhone(raw: string): string {
  // Strip everything except + and digits.
  return raw.replace(/[^\d+]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const correlationId = crypto.randomUUID();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON", correlation_id: correlationId }, 400);
  }

  const caseIdRaw = body.caseId;
  const tokenRaw = body.token;
  const regNoRaw = body.reg_no;
  const phoneRaw = body.callback_phone_number;

  if (typeof caseIdRaw !== "string" || !UUID_RE.test(caseIdRaw.trim())) {
    return jsonResponse(
      { ok: false, error: "Invalid caseId (must be UUID)", correlation_id: correlationId },
      400,
    );
  }
  if (typeof tokenRaw !== "string" || !tokenRaw.trim()) {
    return jsonResponse({ ok: false, error: "Missing token", correlation_id: correlationId }, 400);
  }

  // At least one of the two fields must be provided. The form UI requires both,
  // but we keep the API tolerant in case one becomes optional later.
  const hasReg = typeof regNoRaw === "string" && regNoRaw.trim().length > 0;
  const hasPhone = typeof phoneRaw === "string" && phoneRaw.trim().length > 0;
  if (!hasReg && !hasPhone) {
    return jsonResponse(
      { ok: false, error: "Provide reg_no and/or callback_phone_number", correlation_id: correlationId },
      400,
    );
  }

  let regNo: string | null = null;
  if (hasReg) {
    const normalized = normalizeRegNo((regNoRaw as string).trim());
    if (!REG_NO_RE.test(normalized)) {
      return jsonResponse(
        { ok: false, error: "Invalid registration number", correlation_id: correlationId },
        400,
      );
    }
    regNo = normalized;
  }

  let phone: string | null = null;
  if (hasPhone) {
    const normalized = normalizePhone((phoneRaw as string).trim());
    if (!PHONE_RE.test((phoneRaw as string).trim()) || normalized.replace(/\D/g, "").length < 6) {
      return jsonResponse(
        { ok: false, error: "Invalid phone number", correlation_id: correlationId },
        400,
      );
    }
    phone = normalized;
  }

  const caseId = caseIdRaw.trim();
  const token = tokenRaw.trim();

  const tokenOk = await verifyToken(caseId, token);
  if (!tokenOk) {
    console.warn(`[${correlationId}] Invalid token for caseId=${caseId}`);
    return jsonResponse({ ok: false, error: "Invalid token", correlation_id: correlationId }, 403);
  }

  console.log(`[${correlationId}] Form submit caseId=${caseId} reg=${regNo} phone=${phone}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const update: Record<string, unknown> = {
    form_submitted_at: new Date().toISOString(),
    form_submission_source: "lovable_form_page",
    form_raw: { reg_no: regNo, callback_phone_number: phone, correlation_id: correlationId },
  };
  if (regNo) update.form_registration_number = regNo;
  if (phone) update.form_callback_phone_number = phone;

  const { error } = await supabase.from("calls").update(update).eq("id", caseId);

  if (error) {
    console.error(`[${correlationId}] DB update failed:`, error);
    return jsonResponse(
      { ok: false, error: "Failed to save form data", correlation_id: correlationId },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    reg_no: regNo,
    callback_phone_number: phone,
    correlation_id: correlationId,
  });
});
