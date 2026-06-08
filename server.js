import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { extname, join, normalize } from 'path'
import crypto from 'crypto'

const port = process.env.PORT || 3000
const base = './dist'

// ─────────────────────────────────────────────────────────────────────────────
// App-wide access gate (server-side, never exposed to the frontend bundle)
//
// The dashboard at app.beyondcode.ai is protected behind a single shared
// password read from the APP_ACCESS_PASSWORD environment variable. On a correct
// password we set a signed, HTTP-only session cookie. The static SPA assets and
// the public SMS pages (/location, /form, /combined) stay public so live Twilio
// call flows are never broken — actual enforcement happens in the React
// PasswordGate via the /api/app-auth/* endpoints below.
//
// This is intentionally small and self-contained so it can later be replaced by
// proper per-account email/password auth without touching the static serving.
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD || ''
// Signing key for the session cookie. Falls back to the access password so that
// rotating the password also invalidates every existing session.
const SESSION_SECRET = process.env.APP_SESSION_SECRET || ACCESS_PASSWORD
const IS_PROD = process.env.NODE_ENV === 'production'
const COOKIE_NAME = 'bc_app_session'
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url')
}

function issueToken(ttlMs) {
  const exp = String(Date.now() + ttlMs)
  return `${exp}.${sign(exp)}`
}

function verifyToken(token) {
  if (!token || !SESSION_SECRET) return false
  const idx = token.lastIndexOf('.')
  if (idx <= 0) return false
  const exp = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = sign(exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  const expMs = Number(exp)
  return Number.isFinite(expMs) && expMs > Date.now()
}

function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// ─── Minimal in-memory rate limiting for login attempts (per client IP) ───
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
const attempts = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

function isSecureRequest(req) {
  return IS_PROD || (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https'
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders })
  res.end(payload)
}

function readBody(req, limitBytes = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let data = ''
    let tooLarge = false
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > limitBytes) {
        tooLarge = true
        req.destroy()
      }
    })
    req.on('end', () => (tooLarge ? reject(new Error('payload_too_large')) : resolve(data)))
    req.on('error', reject)
  })
}

function buildCookie(value, maxAgeMs, secure) {
  const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  if (maxAgeMs != null) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`)
  return parts.join('; ')
}

async function handleAuthApi(req, res, pathname) {
  const secure = isSecureRequest(req)

  if (pathname === '/api/app-auth/status' && req.method === 'GET') {
    const cookies = parseCookies(req.headers.cookie)
    return sendJson(res, 200, {
      authenticated: verifyToken(cookies[COOKIE_NAME]),
      configured: Boolean(ACCESS_PASSWORD),
    })
  }

  if (pathname === '/api/app-auth/logout' && req.method === 'POST') {
    const expired = buildCookie('', 0, secure)
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': expired })
  }

  if (pathname === '/api/app-auth/login' && req.method === 'POST') {
    // Fail closed: if no password is configured we never grant access.
    if (!ACCESS_PASSWORD) {
      console.warn('[app-auth] APP_ACCESS_PASSWORD is not set — refusing all logins')
      return sendJson(res, 503, { ok: false, error: 'auth_not_configured' })
    }

    const ip = clientIp(req)
    if (rateLimited(ip)) {
      return sendJson(res, 429, { ok: false, error: 'too_many_attempts' })
    }

    let body
    try {
      body = JSON.parse((await readBody(req)) || '{}')
    } catch {
      return sendJson(res, 400, { ok: false, error: 'bad_request' })
    }

    const password = typeof body.password === 'string' ? body.password : ''
    const remember = body.remember === true

    // NOTE: never log the submitted password value.
    if (!constantTimeEqual(password, ACCESS_PASSWORD)) {
      return sendJson(res, 401, { ok: false, error: 'invalid_password' })
    }

    const ttl = remember ? REMEMBER_TTL_MS : SESSION_TTL_MS
    const token = issueToken(ttl)
    const cookie = buildCookie(token, remember ? REMEMBER_TTL_MS : null, secure)
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookie })
  }

  return sendJson(res, 404, { ok: false, error: 'not_found' })
}

function serveStatic(req, res, pathname) {
  // Resolve within ./dist, guard against path traversal, SPA-fallback to index.
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(base, safePath === '/' ? '/index.html' : safePath)

  if (!filePath.startsWith(normalize(base))) {
    filePath = join(base, '/index.html')
  }
  if (!existsSync(filePath)) {
    filePath = join(base, '/index.html') // SPA fallback
  }

  const ext = extname(filePath)
  const contentType = mimeTypes[ext] || 'text/plain'

  try {
    const content = readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch {
    res.writeHead(500)
    res.end('Server error')
  }
}

createServer(async (req, res) => {
  const pathname = (() => {
    try {
      return new URL(req.url, 'http://localhost').pathname
    } catch {
      return req.url || '/'
    }
  })()

  // Unauthenticated health checks (Railway / load balancers)
  if (pathname === '/healthz' || pathname === '/health') {
    return sendJson(res, 200, { ok: true })
  }

  if (pathname.startsWith('/api/app-auth/')) {
    try {
      return await handleAuthApi(req, res, pathname)
    } catch {
      return sendJson(res, 500, { ok: false, error: 'server_error' })
    }
  }

  return serveStatic(req, res, pathname)
}).listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
  if (!ACCESS_PASSWORD) {
    console.warn('[app-auth] WARNING: APP_ACCESS_PASSWORD is not set — the app gate will reject all logins')
  }
})
