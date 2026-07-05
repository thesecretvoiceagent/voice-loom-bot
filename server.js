import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { extname, join, normalize } from 'path'

const port = process.env.PORT || 3000
const base = './dist'

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

createServer((req, res) => {
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

  return serveStatic(req, res, pathname)
}).listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`)
})
