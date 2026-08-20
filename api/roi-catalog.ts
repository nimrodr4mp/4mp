import type { IncomingMessage, ServerResponse } from 'node:http'
import { applyCors, makeEnvReader, sendJson, supaFromEnv } from './_roi.js'

/**
 * Public: the ROI calculator's device/treatment catalog.
 *
 * Read-only, no token. The catalog is the sales pitch — device prices and
 * treatment prices — so it is public by the same decision that makes the
 * calculator itself public (see DEPLOY.md in the 4mp-roi-calculator repo).
 * Nothing customer-specific is served here.
 *
 * The response is shaped exactly like the old hard-coded DEFAULT_CATALOG in
 * app.js, so the front end consumes it without a translation layer.
 */

type DeviceRow = {
  id: string
  name: string
  short_name: string
  category: string
  price: number | string
  sort_order: number
}

type TreatmentRow = {
  id: string
  device_id: string
  name: string
  price: number | string
  monthly_clients: number
  sort_order: number
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const env = makeEnvReader(req)
  applyCors(req, res, env)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })

  const supa = supaFromEnv(env)
  if (!supa) return sendJson(res, 500, { error: 'server_not_configured' })

  try {
    const [devices, treatments] = await Promise.all([
      supa.get<DeviceRow>(
        'roi_devices?is_active=eq.true&select=id,name,short_name,category,price,sort_order&order=sort_order',
      ),
      supa.get<TreatmentRow>(
        'roi_treatments?select=id,device_id,name,price,monthly_clients,sort_order&order=sort_order',
      ),
    ])

    const catalog = devices.map((d) => ({
      id: d.id,
      name: d.name,
      short: d.short_name,
      cat: d.category,
      price: Number(d.price),
      treatments: treatments
        .filter((t) => t.device_id === d.id)
        .map((t) => ({ id: t.id, name: t.name, price: Number(t.price), count: t.monthly_clients })),
    }))

    return sendJson(res, 200, { catalog })
  } catch {
    // Deliberately opaque: the detail would leak schema/connection information
    // to an unauthenticated caller.
    return sendJson(res, 502, { error: 'catalog_unavailable' })
  }
}
