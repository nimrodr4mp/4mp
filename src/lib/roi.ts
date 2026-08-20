import { selectAll } from './supabase'

/**
 * Shared bits for the ROI calculator's presence inside the CRM.
 *
 * Staff read roi_users/roi_scenarios directly through supabase-js: the
 * migration grants `authenticated` SELECT on both, and the JWT from /api/login
 * carries the role RLS checks. Only the public calculator has to go through the
 * serverless endpoints, because it has no login at all.
 */

/** Where the customer-facing calculator lives. Override per environment. */
export const ROI_CALCULATOR_URL =
  (import.meta.env.VITE_ROI_CALCULATOR_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://4mp-roi.vercel.app'

export interface RoiUser {
  id: string
  name: string
  city: string | null
  phone: string
  phone_norm: string
  lead_id: string | null
  resume_token: string
  created_at: string
  last_seen_at: string
}

export interface RoiScenario {
  id: string
  roi_user_id: string
  device_id: string | null
  device_name: string | null
  monthly_revenue: number | null
  monthly_profit: number | null
  payback_months: number | null
  updated_at: string
}

/** Israeli 0XXXXXXXXX form; '' if unusable. Mirrors api/_roi.ts so the CRM and
 *  the endpoints agree on what counts as the same number. */
export function normalizePhone(raw: string | null | undefined): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00972')) d = d.slice(5)
  else if (d.startsWith('972')) d = d.slice(3)
  if (!d.startsWith('0')) d = '0' + d
  return d
}

/** Opening someone's saved plan is just the resume link the customer uses. */
export function roiCalculatorLink(token: string): string {
  return `${ROI_CALCULATOR_URL}/?p=${encodeURIComponent(token)}`
}

export async function loadRoiUsers(): Promise<RoiUser[]> {
  return selectAll<RoiUser>('roi_users', '*', 'created_at')
}

/**
 * Index registrants for lookup from a lead row.
 *
 * lead_id is the reliable key, but it is only set when the registration
 * actually created or matched a lead — a registration made while
 * ROI_CREATE_LEADS was off has none, and a lead created by hand afterwards
 * would never link. Phone is the fallback so those still resolve.
 */
export function indexRoiUsers(users: RoiUser[]): {
  byLeadId: Map<string, RoiUser>
  byPhone: Map<string, RoiUser>
} {
  const byLeadId = new Map<string, RoiUser>()
  const byPhone = new Map<string, RoiUser>()
  for (const u of users) {
    if (u.lead_id) byLeadId.set(u.lead_id, u)
    if (u.phone_norm) byPhone.set(u.phone_norm, u)
  }
  return { byLeadId, byPhone }
}

export function findRoiUserForLead(
  index: { byLeadId: Map<string, RoiUser>; byPhone: Map<string, RoiUser> },
  lead: { id: string; phone: string | null },
): RoiUser | null {
  return index.byLeadId.get(lead.id) ?? index.byPhone.get(normalizePhone(lead.phone)) ?? null
}
