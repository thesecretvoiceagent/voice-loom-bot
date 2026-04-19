// Public endpoint — called from a static-ish location confirmation page opened
// from an SMS link during a live call. THIN by design:
//   1. validate input
//   2. verify HMAC token (must match LOCATION_TOKEN_SECRET, same as orchestrator)
//   3. reverse-geocode (best effort)
//   4. UPDATE the calls row (caseId = calls.id UUID)
//   5. return { ok, address, lat, lng }
//
// Orchestrator listens to the calls UPDATE via realtime and injects into the
// live OpenAI Realtime session. We do NOT talk to the bot directly.
//
// Contract is intentionally identical to Railway's /api/location/confirm
// (orchestrator/src/routes/location.ts) so a later switch is a URL swap only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Constant-time hex compare. */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * HMAC-SHA256(caseId) hex, using LOCATION_TOKEN_SECRET.
 * Matches orchestrator/src/routes/location.ts and ws/media-stream.ts so the
 * SAME link works whether it was minted by Railway or by Lovable.
 */
async function verifyToken(caseId: string, token: string): Promise<boolean> {
  const secret = Deno.env.get("LOCATION_TOKEN_SECRET") || "";
  if (!secret) {
    // Fail closed in production; permissive only when explicitly allowed via env flag.
    console.warn("[location-confirm] LOCATION_TOKEN_SECRET not set — rejecting");
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

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
  if (!key) {
    console.warn("[location-confirm] GOOGLE_MAPS_API_KEY not set — skipping reverse geocode");
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=et&key=${encodeURIComponent(
    key,
  )}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[location-confirm] Google HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    if (data?.status && data.status !== "OK") {
      console.error(`[location-confirm] Google status=${data.status} error=${data.error_message ?? ""}`);
      return null;
    }
    const first = data?.results?.[0];
    return first?.formatted_address ?? null;
  } catch (err) {
    console.error("[location-confirm] reverse geocode error:", err);
    return null;
  }
}

async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const key = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    query,
  )}&language=et&region=ee&key=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[location-confirm] forward geocode HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data?.status !== "OK") {
      console.error(
        `[location-confirm] forward geocode status=${data?.status} error=${data?.error_message ?? ""}`,
      );
      return null;
    }
    const first = data.results?.[0];
    const loc = first?.geometry?.location;
    if (!first || !loc) return null;
    return {
      lat: Number(loc.lat),
      lng: Number(loc.lng),
      address: first.formatted_address ?? query,
    };
  } catch (err) {
    console.error("[location-confirm] forward geocode error:", err);
    return null;
  }
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

  // Mode: address search (no DB write, no token required)
  // Used by the confirmation page's search input to suggest a location.
  if (body.mode === "search") {
    const q = typeof body.query === "string" ? body.query.trim() : "";
    if (!q) {
      return jsonResponse({ ok: false, error: "Missing query", correlation_id: correlationId }, 400);
    }
    const hit = await forwardGeocode(q);
    if (!hit) {
      return jsonResponse(
        { ok: false, error: "Aadressi ei leitud", correlation_id: correlationId },
        404,
      );
    }
    return jsonResponse({ ok: true, ...hit, correlation_id: correlationId });
  }

  const caseIdRaw = body.caseId;
  const tokenRaw = body.token;
  const latRaw = body.lat;
  // Accept both `lng` (page contract) and `lon` (orchestrator legacy) for robustness.
  const lngRaw = body.lng ?? body.lon;

  if (typeof caseIdRaw !== "string" || !UUID_RE.test(caseIdRaw.trim())) {
    return jsonResponse(
      { ok: false, error: "Invalid caseId (must be UUID)", correlation_id: correlationId },
      400,
    );
  }
  if (typeof tokenRaw !== "string" || !tokenRaw.trim()) {
    return jsonResponse({ ok: false, error: "Missing token", correlation_id: correlationId }, 400);
  }
  const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return jsonResponse({ ok: false, error: "Invalid lat", correlation_id: correlationId }, 400);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return jsonResponse({ ok: false, error: "Invalid lng", correlation_id: correlationId }, 400);
  }

  const caseId = caseIdRaw.trim();
  const token = tokenRaw.trim();

  const tokenOk = await verifyToken(caseId, token);
  if (!tokenOk) {
    console.warn(`[${correlationId}] Invalid token for caseId=${caseId}`);
    return jsonResponse({ ok: false, error: "Invalid token", correlation_id: correlationId }, 403);
  }

  console.log(`[${correlationId}] Confirming location caseId=${caseId} lat=${lat} lng=${lng}`);

  // Reverse geocode is best-effort — we still persist the coordinates.
  const address = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("calls")
    .update({
      location_confirmed: true,
      location_lat: lat,
      location_lon: lng,
      location_address: address,
      location_confirmed_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (error) {
    console.error(`[${correlationId}] DB update failed:`, error);
    return jsonResponse(
      { ok: false, error: "Failed to save location", correlation_id: correlationId },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    address,
    lat,
    lng,
    correlation_id: correlationId,
  });
});
