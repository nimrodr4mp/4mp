import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Dev-only: mount the Vercel serverless functions in `/api` into the Vite dev
 * server so `npm run dev` behaves like production. Non-VITE_ env vars from .env
 * (service_role key, JWT secret) are injected into process.env for the handlers.
 */
function apiDevServer(env: Record<string, string>): Plugin {
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('VITE_') && process.env[k] === undefined) process.env[k] = v
  }
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '')
        try {
          const mod = await server.ssrLoadModule(`/api/${route}.ts`)
          await mod.default(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_api_error', detail: String(err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevServer(env)],
  }
})
