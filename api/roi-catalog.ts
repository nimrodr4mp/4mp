import type { IncomingMessage, ServerResponse } from 'node:http'
import { applyCors, makeEnvReader, sendJson, supaFromEnv, type Supa } from './_roi.js'

/**
 * Public: the ROI calculator's device/treatment catalog.
 *
 * Without a token this serves the shared catalog — the same list every visitor
 * sees. With a valid x-roi-token it serves that customer's tailored version:
 * only the devices picked for them, with any per-customer prices and
 * clients-per-month applied and hidden treatments removed.
 *
 * A customer with no rows in roi_user_devices gets the shared catalog
 * untouched, so tailoring is opt-in per person and nobody's existing plan
 * changes shape when this ships.
 *
 * An unknown token is treated as no token rather than an error: the catalog is
 * public either way, and failing the whole calculator over a stale link would
 * be worse than showing the default list.
 *
 * The response shape is unchanged, so the front end needs no translation layer.
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

type UserDeviceRow = { device_id: string; price: number | string | null; sort_order: number }
type UserTreatmentRow = {
  treatment_id: string
  price: number | string | null
  monthly_clients: number | null
  is_hidden: boolean
}

type Overrides = {
  devices: Map<string, UserDeviceRow>
  treatments: Map<string, UserTreatmentRow>
}

function tokenFrom(req: IncomingMessage): string {
  const header = req.headers['x-roi-token']
  return String(Array.isArray(header) ? header[0] : (header ?? '')).trim()
}

/**
 * Resolve the caller's per-customer catalog, or null when there is none.
 *
 * Never throws. Tailoring is an enhancement on top of a catalog that must keep
 * being served: if this code is deployed before
 * migration-roi-per-customer-catalog.sql has been run, the override tables do
 * not exist yet, and letting that error escape would 502 the endpoint and take
 * the whole public calculator down for everyone. Falling back to the shared
 * catalog is always the safe answer.
 */
async function loadOverrides(supa: Supa, token: string): Promise<Overrides | null> {
  if (!token || token.length < 20) return null

  try {
    const users = await supa.get<{ id: string }>(
      `roi_users?resume_token=eq.${encodeURIComponent(token)}&select=id`,
    )
    const user = users[0]
    if (!user) return null

    const [devices, treatments] = await Promise.all([
      supa.get<UserDeviceRow>(
        `roi_user_devices?roi_user_id=eq.${encodeURIComponent(user.id)}` +
          `&select=device_id,price,sort_order&order=sort_order`,
      ),
      supa.get<UserTreatmentRow>(
        `roi_user_treatments?roi_user_id=eq.${encodeURIComponent(user.id)}` +
          `&select=treatment_id,price,monthly_clients,is_hidden`,
      ),
    ])

    return {
      devices: new Map(devices.map((d) => [d.device_id, d])),
      treatments: new Map(treatments.map((t) => [t.treatment_id, t])),
    }
  } catch {
    return null
  }
}

/** null/undefined means "inherit from the catalog", so 0 must survive. */
function pick(override: number | string | null | undefined, fallback: number): number {
  return override === null || override === undefined ? fallback : Number(override)
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
    const [devices, treatments, overrides] = await Promise.all([
      supa.get<DeviceRow>(
        'roi_devices?is_active=eq.true&select=id,name,short_name,category,price,sort_order&order=sort_order',
      ),
      supa.get<TreatmentRow>(
        'roi_treatments?select=id,device_id,name,price,monthly_clients,sort_order&order=sort_order',
      ),
      loadOverrides(supa, tokenFrom(req)),
    ])

    // Only a customer who actually has devices picked gets a narrowed list.
    const tailored = overrides !== null && overrides.devices.size > 0
    const visible = tailored ? devices.filter((d) => overrides.devices.has(d.id)) : devices

    const ordered = tailored
      ? [...visible].sort(
          (a, b) =>
            (overrides.devices.get(a.id)?.sort_order ?? 0) -
            (overrides.devices.get(b.id)?.sort_order ?? 0),
        )
      : visible

    const catalog = ordered.map((d) => {
      const dOv = overrides?.devices.get(d.id)
      return {
        id: d.id,
        name: d.name,
        short: d.short_name,
        cat: d.category,
        price: pick(dOv?.price, Number(d.price)),
        treatments: treatments
          .filter((t) => t.device_id === d.id)
          .filter((t) => !overrides?.treatments.get(t.id)?.is_hidden)
          .map((t) => {
            const tOv = overrides?.treatments.get(t.id)
            return {
              id: t.id,
              name: t.name,
              price: pick(tOv?.price, Number(t.price)),
              count: pick(tOv?.monthly_clients, t.monthly_clients),
            }
          }),
      }
    })

    return sendJson(res, 200, { catalog, tailored })
  } catch {
    // Deliberately opaque: the detail would leak schema/connection information
    // to an unauthenticated caller.
    return sendJson(res, 502, { error: 'catalog_unavailable' })
  }
}
