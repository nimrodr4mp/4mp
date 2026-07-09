import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Public webhook that ingests Elementor / WordPress form submissions from
 * www.4mp.co.il and creates leads (source = website). Protected by a shared
 * secret. Writes with the Supabase service_role key (bypasses RLS).
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
 *      LEAD_WEBHOOK_SECRET, optional LEAD_DEFAULT_ASSIGNEE (sales_person id).
 */

function makeEnvReader(req: IncomingMessage) {
  const injected = (req as IncomingMessage & { __env?: Record<string, string> }).__env
  return (key: string): string =>
    injected?.[key] ?? (process.env as Record<string, string | undefined>)[key] ?? ''
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function readRaw(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const anyReq = req as IncomingMessage & { body?: unknown }
    if (typeof anyReq.body === 'string') return resolve(anyReq.body)
    if (anyReq.body && typeof anyReq.body === 'object') return resolve(JSON.stringify(anyReq.body))
    // Collect raw bytes and decode once as UTF-8 so multi-byte Hebrew isn't
    // corrupted by a multi-byte char landing on a chunk boundary.
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

/** Normalize a raw phone to an Israeli 0XXXXXXXXX form; '' if unusable. */
function normalizePhone(raw: string): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00972')) d = d.slice(5)
  else if (d.startsWith('972')) d = d.slice(3)
  if (!d.startsWith('0')) d = '0' + d
  return d
}

/** Extract {label,value} pairs from the various shapes WP/Elementor can send. */
function extractPairs(
  raw: string,
  contentType: string,
): { pairs: { label: string; value: string }[]; meta: Record<string, string> } {
  const pairs: { label: string; value: string }[] = []
  const meta: Record<string, string> = {}

  const pushObj = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v)
      pairs.push({ label: k, value: val })
    }
  }

  if (contentType.includes('application/json')) {
    try {
      const body = JSON.parse(raw || '{}') as Record<string, unknown>
      for (const key of ['form_name', 'page_url', 'referrer', 'referer', 'source_url']) {
        if (typeof body[key] === 'string') meta[key] = body[key] as string
      }
      const fields = (body.fields ?? body.form_fields ?? body) as Record<string, unknown>
      if (fields && typeof fields === 'object') pushObj(fields as Record<string, unknown>)
    } catch {
      /* ignore */
    }
  } else {
    // urlencoded (Elementor native webhook): form_fields[<id>]=value & meta keys
    const params = new URLSearchParams(raw)
    for (const [k, v] of params.entries()) {
      const m = k.match(/^form_fields\[(.+)\]$/)
      if (m) pairs.push({ label: m[1], value: v })
      else if (['form_name', 'page_url', 'referrer', 'referer'].includes(k)) meta[k] = v
    }
  }
  return { pairs, meta }
}

function detectFields(pairs: { label: string; value: string }[]) {
  let name = '',
    phone = '',
    email = '',
    city = ''
  const extras: string[] = []
  const rest: { label: string; value: string }[] = []

  // Pass 1: label-based
  for (const { label, value } of pairs) {
    if (!value) continue
    const l = label.toLowerCase()
    if (!name && /(^|[^a-z])name|full.?name|שם/.test(l)) name = value
    else if (!phone && /phone|tel|mobile|טלפון|נייד|פלאפ|סלול/.test(l)) phone = value
    else if (!email && /e.?mail|mail|דוא|אימייל|מייל/.test(l)) email = value
    else if (!city && /city|town|עיר|יישוב|ישוב|מגור/.test(l)) city = value
    else rest.push({ label, value })
  }
  // Pass 2: value-based fallback for anything still missing
  for (const { label, value } of rest) {
    if (!email && value.includes('@')) {
      email = value
      continue
    }
    if (!phone && /^[\d\-\+\(\)\s]{7,20}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7) {
      phone = value
      continue
    }
    if (!name && /^[\p{L}][\p{L}\s'".-]{1,60}$/u.test(value) && !/https?:/.test(value)) {
      name = value
      continue
    }
    extras.push(`${label}: ${value}`)
  }
  return { name, phone, email, city, extras }
}

async function sb(
  env: (k: string) => string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
  const env = makeEnvReader(req)

  const supabaseUrl = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY')
  const secret = env('LEAD_WEBHOOK_SECRET')
  if (!supabaseUrl || !serviceRole || !secret) {
    return sendJson(res, 500, { error: 'server_not_configured' })
  }

  // Auth: secret via ?token=, ?secret=, x-webhook-secret header, or body.secret
  const urlObj = new URL(req.url ?? '', 'http://localhost')
  const contentType = String(req.headers['content-type'] ?? '')
  const raw = await readRaw(req)
  let bodySecret = ''
  if (contentType.includes('application/json')) {
    try {
      bodySecret = String((JSON.parse(raw || '{}') as Record<string, unknown>).secret ?? '')
    } catch {
      /* ignore */
    }
  }
  const provided =
    urlObj.searchParams.get('token') ??
    urlObj.searchParams.get('secret') ??
    (req.headers['x-webhook-secret'] as string) ??
    bodySecret ??
    ''
  if (provided !== secret) return sendJson(res, 401, { error: 'unauthorized' })

  const { pairs, meta } = extractPairs(raw, contentType)
  const { name, phone, email, city, extras } = detectFields(pairs)

  const normPhone = normalizePhone(phone)
  if (!name && !normPhone && !email) {
    return sendJson(res, 400, { error: 'no_usable_fields' })
  }

  const originUrl = meta.page_url || meta.source_url || meta.referrer || meta.referer || null
  const summaryParts = [...extras]
  if (meta.form_name) summaryParts.unshift(`טופס: ${meta.form_name}`)
  const conversationSummary = summaryParts.join('\n') || null

  // Dedupe by normalized phone
  if (normPhone) {
    const dupRes = await sb(
      env,
      `leads?select=id&phone=eq.${encodeURIComponent(normPhone)}&limit=1`,
    )
    const dup = (await dupRes.json().catch(() => [])) as { id: string }[]
    if (Array.isArray(dup) && dup.length > 0) {
      const leadId = dup[0].id
      await sb(env, `leads?id=eq.${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ is_return: true, updated_at: new Date().toISOString() }),
      })
      await sb(env, 'lead_interactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: randomUUID(),
          lead_id: leadId,
          type: 'log',
          content: `פנייה חוזרת מהאתר${meta.form_name ? ` (${meta.form_name})` : ''}`,
          created_by: 'website',
        }),
      })
      return sendJson(res, 200, { status: 'duplicate', lead_id: leadId })
    }
  }

  const now = new Date().toISOString()
  const insertRes = await sb(env, 'leads', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: randomUUID(),
      name: name || 'ליד מהאתר',
      phone: normPhone || '',
      email: email || null,
      city: city || null,
      source: 'website',
      status: 'new',
      score: 0,
      machines_interested: [],
      conversation_summary: conversationSummary,
      origin_url: originUrl,
      assigned_to: env('LEAD_DEFAULT_ASSIGNEE') || null,
      is_archived: false,
      created_at: now,
      updated_at: now,
    }),
  })

  if (!insertRes.ok) {
    return sendJson(res, 500, { error: 'insert_failed', detail: await insertRes.text() })
  }
  const created = (await insertRes.json().catch(() => [])) as { id: string }[]
  return sendJson(res, 200, { status: 'created', lead_id: created[0]?.id })
}
