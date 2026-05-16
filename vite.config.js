import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load all .env files — read every file so keys from .env aren't skipped
// when .env.local exists but doesn't contain the same keys.
function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '')
      }
    } catch { /* file not present */ }
  }
}

loadEnv()

// Vite plugin: handle /api/* requests in dev by running the handler modules.
function apiMiddlewarePlugin() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        const handlerPath = resolve(process.cwd(), req.url.split('?')[0].slice(1) + '.js')
        try {
          // Collect request body
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = Buffer.concat(chunks).toString()

          // Build a minimal req/res interface matching Vercel's handler signature
          const mockReq = {
            method: req.method,
            headers: req.headers,
            url: req.url,
            body: body ? JSON.parse(body) : {},
          }

          let statusCode = 200
          const headers = {}
          let responseBody = null

          const mockRes = {
            status(code) { statusCode = code; return mockRes },
            json(data) {
              headers['Content-Type'] = 'application/json'
              responseBody = JSON.stringify(data)
              res.writeHead(statusCode, headers)
              res.end(responseBody)
            },
            setHeader(k, v) { headers[k] = v },
          }

          // Import the handler fresh each request (bypasses module cache for hot reload)
          delete require.cache?.[handlerPath]
          const mod = await import(`${handlerPath}?t=${Date.now()}`)
          await mod.default(mockReq, mockRes)
        } catch (err) {
          console.error('[api-middleware]', err.message)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiMiddlewarePlugin()],
  server: {
    port: 3000,
    open: true,
  },
})
