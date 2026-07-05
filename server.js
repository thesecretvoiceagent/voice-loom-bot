import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { extname, join, normalize } from 'path'

const port = process.env.PORT || 3000
const base = './dist'

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DEMO_OWNER_USER_ID = '00000000-0000-4000-8000-000000000001'

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

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req, limitBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > limitBytes) {
        req.destroy()
        reject(new Error('payload_too_large'))
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function supabaseRest(path, { method = 'GET', body } = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 503,
      data: {
        ok: false,
        error: 'server_not_configured',
        message: 'Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY on the web service.',
      },
    }
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  return { ok: res.ok, status: res.status, data }
}

async function handleAgentSave(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' })
  }

  let parsed
  try {
    parsed = JSON.parse((await readBody(req)) || '{}')
  } catch {
    return sendJson(res, 400, { ok: false, error: 'bad_request' })
  }

  const action = parsed?.action
  const id = typeof parsed?.id === 'string' ? parsed.id : null
  const payload = parsed?.payload

  if (!payload || typeof payload !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'missing_payload' })
  }

  if (action === 'insert') {
    const row = {
      ...payload,
      user_id: payload.user_id || DEMO_OWNER_USER_ID,
    }
    const result = await supabaseRest('agents', { method: 'POST', body: row })
    if (!result.ok) {
      const msg = result.data?.message || result.data?.error || result.data?.hint || 'insert_failed'
      return sendJson(res, result.status, { ok: false, error: msg, details: result.data })
    }
    const saved = Array.isArray(result.data) ? result.data[0] : result.data
    return sendJson(res, 200, { ok: true, id: saved?.id, agent: saved })
  }

  if (action === 'update') {
    if (!id) return sendJson(res, 400, { ok: false, error: 'missing_id' })
    const result = await supabaseRest(`agents?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: payload,
    })
    if (!result.ok) {
      const msg = result.data?.message || result.data?.error || result.data?.hint || 'update_failed'
      return sendJson(res, result.status, { ok: false, error: msg, details: result.data })
    }
    const saved = Array.isArray(result.data) ? result.data[0] : result.data
    if (!saved) {
      return sendJson(res, 404, { ok: false, error: 'agent_not_found' })
    }
    return sendJson(res, 200, { ok: true, agent: saved })
  }

  return sendJson(res, 400, { ok: false, error: 'unknown_action' })
}

function serveStatic(req, res, pathname) {
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(base, safePath === '/' ? '/index.html' : safePath)

  if (!filePath.startsWith(normalize(base))) {
    filePath = join(base, '/index.html')
  }
  if (!existsSync(filePath)) {
    filePath = join(base, '/index.html')
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

  if (pathname === '/healthz' || pathname === '/health') {
    return sendJson(res, 200, { ok: true })
  }

  if (pathname === '/api/agents/save') {
    try {
      return await handleAgentSave(req, res)
    } catch {
      return sendJson(res, 500, { ok: false, error: 'server_error' })
    }
  }

  return serveStatic(req, res, pathname)
}).listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[agents/save] SUPABASE_SERVICE_ROLE_KEY is not set — agent saves will fail until configured')
  }
})
