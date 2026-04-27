import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REG_NO_RE = /^[A-Z0-9 \-]{2,12}$/i;
function esc(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch] || ch));
}

function html(body: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="et"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Registreerimisnumber</title><style>body{margin:0;background:#050308;color:#f4f0f6;font-family:Arial,sans-serif}.wrap{padding:24px 20px;max-width:520px}.muted{color:#9c94a8}.field{display:block;margin:22px 0 8px;font-size:14px;font-weight:700}input{box-sizing:border-box;width:100%;height:52px;border:1px solid #342e3d;border-radius:8px;background:#24202d;color:#fff;font-size:18px;padding:0 14px;text-transform:uppercase;letter-spacing:.08em}button{width:100%;height:56px;margin-top:18px;border:0;border-radius:8px;background:#23966f;color:#07100d;font-size:17px;font-weight:800}.err{margin-top:16px;color:#ffb4ab}.ok{margin-top:20px;color:#91f3c3;font-weight:800}</style></head><body><main class="wrap">${body}</main></body></html>`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function extractParams(req: Request, form?: FormData): { caseId: string; token: string } {
  const url = new URL(req.url);
  let caseId = (form?.get("caseId") || url.searchParams.get("caseId") || "").toString();
  let token = (form?.get("token") || url.searchParams.get("token") || "").toString();
  const src = url.searchParams.get("src") || url.search;
  if (!caseId) caseId = src.match(/caseId=([0-9a-f-]{36})/i)?.[1] || src.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || "";
  if (!token) token = src.match(/token=([0-9a-f]{64})/i)?.[1] || "";
  return { caseId: caseId.trim(), token: token.trim() };
}

function normalizeRegNo(raw: string): string {
  return raw.replace(/[\s\-]/g, "").toUpperCase();
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function verifyToken(caseId: string, token: string): Promise<boolean> {
  const secret = Deno.env.get("LOCATION_TOKEN_SECRET") || "";
  if (!secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(caseId));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeHexEqual(token.toLowerCase(), expected.toLowerCase());
}

function regForm(caseId: string, token: string, message = ""): Response {
  return html(`<h1>Sisesta oma sõiduki andmed</h1><form method="post"><input type="hidden" name="caseId" value="${esc(caseId)}"/><input type="hidden" name="token" value="${esc(token)}"/><label class="field" for="reg">Auto registreerimisnumber</label><input id="reg" name="reg_no" maxlength="12" required autofocus autocomplete="off" autocapitalize="characters" spellcheck="false"/>${message}<button type="submit">Saada</button></form>`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return html("<h1>Meetod pole lubatud</h1>", 405);

  const form = req.method === "POST" ? await req.formData().catch(() => null) : null;
  const { caseId, token } = extractParams(req, form || undefined);
  if (!UUID_RE.test(caseId) || !token) return html("<h1>Link on vigane</h1><p class='muted'>Avage palun SMS-ist saadud link uuesti.</p>", 400);

  if (req.method === "GET") return regForm(caseId, token);

  const regNo = normalizeRegNo((form?.get("reg_no") || "").toString());
  if (!REG_NO_RE.test(regNo)) return regForm(caseId, token, `<div class="err">Registreerimisnumber ei sobi.</div>`);
  if (!(await verifyToken(caseId, token))) return html("<h1>Link ei kehti</h1><p class='muted'>Avage palun SMS-ist saadud link uuesti.</p>", 403);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const correlationId = crypto.randomUUID();
  const { error } = await supabase.from("calls").update({
    form_registration_number: regNo,
    form_submitted_at: new Date().toISOString(),
    form_submission_source: "iizi_reg_form_edge",
    form_raw: { mode: "reg", reg_no: regNo, correlation_id: correlationId },
  }).eq("id", caseId);
  if (error) return html("<h1>Salvestamine ebaõnnestus</h1><p class='muted'>Palun proovige uuesti.</p>", 500);
  return html(`<h1>Andmed saadetud</h1><p class="ok">Reg: ${regNo}</p><p class="muted">AI assistent saab selle vestluses kätte.</p>`);
});