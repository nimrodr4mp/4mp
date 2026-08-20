import { randomBytes, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  applyCors,
  isMobile,
  makeEnvReader,
  normalizePhone,
  readBody,
  sendJson,
  supaFromEnv,
  type Supa,
} from './_roi.js'

/**
 * Public: registration, resume and save for the ROI calculator.
 *
 *   POST /api/roi-session            {name, city, phone}  -> {token, user}
 *   GET  /api/roi-session            x-roi-token header   -> {user, scenario}
 *   PUT  /api/roi-session            x-roi-token header   -> {ok}
 *
 * ── What the token is, and is not ──
 * resume_token is a capability: whoever holds the link holds the scenario.
 * It is NOT authentication. Name + city + phone identify a person, they do not
 * prove identity, and no password is collected — so the token is minted
 * server-side from 32 random bytes and is never derived from the phone number.
 * Consequence, stated plainly: a forwarded link exposes that one scenario.
 * Nothing else is reachable with it — there is no listing endpoint here, and a
 * token only ever resolves to its own row.
 */

const TOKEN_BYTES = 32
const MAX_STATE_BYTES = 64 * 1024

type RoiUser = {
  id: string
  name: string
  city: string | null
  phone: string
  phone_norm: string
  lead_id: string | null
  resume_token: string
}

type RoiScenario = {
  id: string
  roi_user_id: string
  device_id: string | null
  device_name: string | null
  state: Record<string, unknown>
  updated_at: string
}

function tokenFrom(req: IncomingMessage): string {
  const header = req.headers['x-roi-token']
  return String(Array.isArray(header) ? header[0] : (header ?? '')).trim()
}

/** Resolve the caller's row from their token. Null when the token is unknown. */
async function userForToken(supa: Supa, token: string): Promise<RoiUser | null> {
  if (!token || token.length < 20) return null
  const rows = await supa.get<RoiUser>(
    `roi_users?resume_token=eq.${encodeURIComponent(token)}` +
      `&select=id,name,city,phone,phone_norm,lead_id,resume_token`,
  )
  return rows[0] ?? null
}

/**
 * Create a CRM lead for a registration, so the sales pipeline sees it the same
 * way it sees a website form. Best-effort: a lead failure must not cost the
 * customer their calculator. Returns the lead id, or null.
 *
 * Set ROI_CREATE_LEADS=false to register ROI users without touching `leads`.
 */
async function createLead(
  supa: Supa,
  env: (k: string) => string,
  user: { name: string; city: string; phoneNorm: string },
): Promise<string | null> {
  if (env('ROI_CREATE_LEADS').toLowerCase() === 'false') return null
  try {
    // Don't create a second lead for someone already in the pipeline.
    const existing = await supa.get<{ id: string }>(
      `leads?phone=eq.${encodeURIComponent(user.phoneNorm)}&select=id&limit=1`,
    )
    if (existing[0]) return existing[0].id

    const id = randomUUID()
    const assignee = env('LEAD_DEFAULT_ASSIGNEE')
    await supa.send('POST', 'leads', {
      id,
      name: user.name,
      phone: user.phoneNorm,
      city: user.city || null,
      source: 'roi_calculator',
      status: 'new',
      assigned_to: assignee || null,
      notes: 'נרשם/ה במחשבון החזר ההשקעה',
    }, 'return=minimal')
    return id
  } catch {
    return null
  }
}

async function register(
  req: IncomingMessage,
  res: ServerResponse,
  supa: Supa,
  env: (k: string) => string,
): Promise<void> {
  const body = await readBody(req)
  const name = String(body.name ?? '').trim()
  const city = String(body.city ?? '').trim()
  const phoneRaw = String(body.phone ?? '').trim()
  const phone = normalizePhone(phoneRaw)

  if (name.length < 2) return sendJson(res, 400, { error: 'invalid_name' })
  if (!isMobile(phone)) return sendJson(res, 400, { error: 'invalid_phone' })
  if (name.length > 120 || city.length > 120) return sendJson(res, 400, { error: 'field_too_long' })

  // Same phone registering again: hand back the existing scenario rather than
  // silently starting them over with a second, orphaned row.
  const existing = await supa.get<RoiUser>(
    `roi_users?phone_norm=eq.${encodeURIComponent(phone)}` +
      `&select=id,name,city,phone,phone_norm,lead_id,resume_token&order=created_at.desc&limit=1`,
  )
  if (existing[0]) {
    await supa.send('PATCH', `roi_users?id=eq.${encodeURIComponent(existing[0].id)}`,
      { last_seen_at: new Date().toISOString() }, 'return=minimal')
    return sendJson(res, 200, {
      token: existing[0].resume_token,
      user: { id: existing[0].id, name: existing[0].name, city: existing[0].city },
      returning: true,
    })
  }

  const leadId = await createLead(supa, env, { name, city, phoneNorm: phone })
  const id = randomUUID()
  const token = randomBytes(TOKEN_BYTES).toString('base64url')

  await supa.send('POST', 'roi_users', {
    id,
    name,
    city: city || null,
    phone: phoneRaw,
    phone_norm: phone,
    lead_id: leadId,
    resume_token: token,
    user_agent: String(req.headers['user-agent'] ?? '').slice(0, 300),
  }, 'return=minimal')

  return sendJson(res, 201, { token, user: { id, name, city }, returning: false })
}

async function resume(res: ServerResponse, supa: Supa, user: RoiUser): Promise<void> {
  const rows = await supa.get<RoiScenario>(
    `roi_scenarios?roi_user_id=eq.${encodeURIComponent(user.id)}` +
      `&select=id,roi_user_id,device_id,device_name,state,updated_at&limit=1`,
  )
  await supa.send('PATCH', `roi_users?id=eq.${encodeURIComponent(user.id)}`,
    { last_seen_at: new Date().toISOString() }, 'return=minimal')

  return sendJson(res, 200, {
    user: { id: user.id, name: user.name, city: user.city },
    scenario: rows[0] ? { state: rows[0].state, updated_at: rows[0].updated_at } : null,
  })
}

async function save(
  req: IncomingMessage,
  res: ServerResponse,
  supa: Supa,
  user: RoiUser,
): Promise<void> {
  const body = await readBody(req)
  const state = body.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return sendJson(res, 400, { error: 'invalid_state' })
  }
  const serialized = JSON.stringify(state)
  if (serialized.length > MAX_STATE_BYTES) return sendJson(res, 413, { error: 'state_too_large' })

  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const summary = (body.summary ?? {}) as Record<string, unknown>

  const payback = num(summary.payback_months)
  const row = {
    // One scenario per user, so the scenario id *is* the user id. That keeps the
    // upsert below conflicting on a stable key instead of minting a new primary
    // key on every autosave.
    id: user.id,
    roi_user_id: user.id,
    device_id: typeof body.device_id === 'string' ? body.device_id : null,
    device_name: typeof body.device_name === 'string' ? body.device_name.slice(0, 200) : null,
    state,
    monthly_revenue: num(summary.monthly_revenue),
    monthly_profit: num(summary.monthly_profit),
    // payback_months is INTEGER; a fractional month would be rejected outright.
    payback_months: payback === null ? null : Math.round(payback),
    updated_at: new Date().toISOString(),
  }

  await supa.send('POST', 'roi_scenarios?on_conflict=roi_user_id', row,
    'resolution=merge-duplicates,return=minimal')

  return sendJson(res, 200, { ok: true })
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const env = makeEnvReader(req)
  applyCors(req, res, env)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const supa = supaFromEnv(env)
  if (!supa) return sendJson(res, 500, { error: 'server_not_configured' })

  try {
    if (req.method === 'POST') return await register(req, res, supa, env)

    if (req.method === 'GET' || req.method === 'PUT') {
      const user = await userForToken(supa, tokenFrom(req))
      // Same response for a malformed token and an unknown one — no oracle for
      // guessing valid tokens.
      if (!user) return sendJson(res, 401, { error: 'invalid_token' })
      return req.method === 'GET' ? await resume(res, supa, user) : await save(req, res, supa, user)
    }

    return sendJson(res, 405, { error: 'method_not_allowed' })
  } catch {
    return sendJson(res, 502, { error: 'request_failed' })
  }
}
