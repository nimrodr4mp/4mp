import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))

/**
 * Dev-only: mount the Vercel serverless functions in `/api` into the Vite dev
 * server so `npm run dev` behaves like production. Non-VITE_ env vars from .env
 * (service_role key, JWT secret) are injected into process.env for the handlers.
 */
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const route = req.url.split('?')[0].replace(/^\/api\//, '').replace(/\/$/, '')
        try {
          // Vite's SSR module runtime doesn't share process.env; pass env via req.
          ;(req as IncomingMessage & { __env?: Record<string, string> }).__env = env
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
  const env = loadEnv(mode, rootDir, '')
  return {
    root: rootDir,
    envDir: rootDir,
    plugins: [react(), apiDevServer(env)],
  }
})
