import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { extname, join } from 'path'

const port = process.env.PORT || 3000
const base = './dist'

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

createServer((req, res) => {
  let filePath = join(base, req.url === '/' ? '/index.html' : req.url)

  if (!existsSync(filePath)) {
    filePath = join(base, '/index.html') // SPA fallback
  }

  const ext = extname(filePath)
  const contentType = mimeTypes[ext] || 'text/plain'

  try {
    const content = readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch (err) {
    res.writeHead(500)
    res.end('Server error')
  }
}).listen(port, () => {
  console.log(`Server running on port ${port}`)
})
