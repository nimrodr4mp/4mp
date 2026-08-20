import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Shared helpers for the public ROI-calculator endpoints (roi-catalog, roi-session).
 *
 * These endpoints are reachable without any login — they serve the public
 * calculator at 4mp-roi.vercel.app. They therefore run with the service_role
 * key server-side and must never echo back anything the caller did not prove
 * they own. The anon key stays revoked on every roi_* table (see
 * supabase/migration-roi-calculator.sql).
 */

/** Resolve env from process.env, or from req.__env under the Vite dev server. */
export function makeEnvReader(req: IncomingMessage) {
  const injected = (req as IncomingMessage & { __env?: Record<string, string> }).__env
  return (key: string): string =>
    injected?.[key] ?? (process.env as Record<string, string | undefined>)[key] ?? ''
}

/**
 * Origins allowed to call these endpoints from a browser. The calculator is on
 * its own Vercel project, so this is a genuine cross-origin call. Configure
 * extra origins (a custom domain, say) with ROI_ALLOWED_ORIGINS, comma-separated.
 */
export function allowedOrigins(env: (k: string) => string): string[] {
  const configured = env('ROI_ALLOWED_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return configured.length > 0
    ? configured
    : ['https://4mp-roi.vercel.app', 'http://localhost:5190']
}

/**
 * Reflect the Origin header only when it is on the allowlist. Never '*': that
 * would let any site on the internet script these endpoints from a visitor's
 * browser.
 */
export function applyCors(req: IncomingMessage, res: ServerResponse, env: (k: string) => string): void {
  const origin = String(req.headers.origin ?? '')
  if (origin && allowedOrigins(env).includes(origin)) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('vary', 'Origin')
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type,x-roi-token')
  res.setHeader('access-control-max-age', '86400')
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

export function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const anyReq = req as IncomingMessage & { body?: unknown }
    if (anyReq.body && typeof anyReq.body === 'object') return resolve(anyReq.body as Record<string, unknown>)
    if (typeof anyReq.body === 'string') {
      try {
        return resolve(JSON.parse(anyReq.body || '{}'))
      } catch {
        return resolve({})
      }
    }
    // Collect raw bytes and decode once as UTF-8, so a multi-byte Hebrew
    // character landing on a chunk boundary isn't corrupted.
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
  })
}

/** Normalize a raw phone to Israeli 0XXXXXXXXX form; '' if unusable.
 *  Same rules as api/lead-webhook.ts, so ROI registrations and website leads
 *  match on the same value. */
export function normalizePhone(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00972')) d = d.slice(5)
  else if (d.startsWith('972')) d = d.slice(3)
  if (!d.startsWith('0')) d = '0' + d
  return d
}

/** An Israeli mobile: 05X followed by 7 digits. */
export function isMobile(normalized: string): boolean {
  return /^05\d{8}$/.test(normalized)
}

export type Supa = {
  url: string
  key: string
  get: <T>(path: string) => Promise<T[]>
  send: <T>(method: 'POST' | 'PATCH', path: string, body: unknown, prefer?: string) => Promise<T[]>
}

/** Minimal PostgREST client. Kept dependency-free, like the other api/ handlers. */
export function makeSupa(url: string, key: string): Supa {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  return {
    url,
    key,
    async get<T>(path: string): Promise<T[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers })
      if (!r.ok) throw new Error(`supabase_get_failed:${r.status}:${await r.text()}`)
      return (await r.json()) as T[]
    },
    async send<T>(
      method: 'POST' | 'PATCH',
      path: string,
      body: unknown,
      prefer = 'return=representation',
    ): Promise<T[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers: { ...headers, Prefer: prefer },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`supabase_${method}_failed:${r.status}:${await r.text()}`)
      const text = await r.text()
      return text ? (JSON.parse(text) as T[]) : []
    },
  }
}

/** Reads the three env vars every ROI endpoint needs, or null if misconfigured. */
export function supaFromEnv(env: (k: string) => string): Supa | null {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return null
  return makeSupa(url, key)
}
