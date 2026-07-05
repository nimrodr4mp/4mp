import { createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Serverless login endpoint.
 * Runs on Vercel (Node function) and is also mounted into the Vite dev server.
 * Verifies the PBKDF2 password using the Supabase service_role key (bypasses RLS),
 * then mints a short-lived HS256 JWT signed with the project's JWT secret so that
 * Supabase/PostgREST trusts it and RLS runs the request as the `authenticated` role.
 */

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

/**
 * Resolve an env var. On Vercel it comes from process.env; in the Vite dev server
 * the SSR runtime doesn't share process.env, so the config middleware passes the
 * loaded env in on `req.__env`.
 */
function makeEnvReader(req: IncomingMessage) {
  const injected = (req as IncomingMessage & { __env?: Record<string, string> }).__env
  return (key: string): string =>
    injected?.[key] ?? (process.env as Record<string, string | undefined>)[key] ?? ''
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = createHmac('sha256', secret).update(data).digest()
  return `${data}.${base64url(sig)}`
}

function verifyPassword(password: string, saltHex: string, hashHex: string): boolean {
  try {
    const computed = pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), 100_000, 32, 'sha256')
    const stored = Buffer.from(hashHex, 'hex')
    return computed.length === stored.length && timingSafeEqual(computed, stored)
  } catch {
    return false
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed' })
  }
  const env = makeEnvReader(req)
  const SUPABASE_URL = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY')
  const JWT_SECRET = env('SUPABASE_JWT_SECRET')
  if (!SUPABASE_URL || !SERVICE_ROLE || !JWT_SECRET) {
    return sendJson(res, 500, { error: 'server_not_configured' })
  }

  const body = await readBody(req)
  const email = String(body.email ?? '').trim()
  const password = String(body.password ?? '')
  if (!email || !password) return sendJson(res, 400, { error: 'missing_credentials' })

  // Look up the user with the service_role key (bypasses RLS).
  const query =
    `${SUPABASE_URL}/rest/v1/app_users?email=eq.${encodeURIComponent(email)}` +
    `&is_active=eq.true&select=id,email,name,role,sales_person_id,report_permissions,password_hash,password_salt`
  const lookup = await fetch(query, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  })
  if (!lookup.ok) return sendJson(res, 500, { error: 'lookup_failed' })

  const rows = (await lookup.json()) as Array<Record<string, string | null> & { report_permissions?: string[] }>
  const user = rows[0]
  if (!user || !user.password_hash || !user.password_salt) {
    return sendJson(res, 401, { error: 'invalid_credentials' })
  }
  if (!verifyPassword(password, user.password_salt, user.password_hash)) {
    return sendJson(res, 401, { error: 'invalid_credentials' })
  }

  const now = Math.floor(Date.now() / 1000)
  const token = signJwt(
    {
      role: 'authenticated',
      aud: 'authenticated',
      sub: user.id,
      email: user.email,
      app_role: user.role,
      name: user.name,
      sales_person_id: user.sales_person_id ?? null,
      report_permissions: user.report_permissions ?? [],
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    JWT_SECRET,
  )

  // Best-effort last_login update (don't block login on failure).
  void fetch(`${SUPABASE_URL}/rest/v1/app_users?id=eq.${encodeURIComponent(String(user.id))}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_login: new Date().toISOString() }),
  }).catch(() => {})

  return sendJson(res, 200, { token })
}
