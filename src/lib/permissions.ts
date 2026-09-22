export type UserRole = 'admin' | 'sales' | 'technician' | 'training_manager'

// 'training_manager' sits across the sales section too: ליאב runs training and
// carries her own book of leads. The ROI screens she can reach need a matching
// RLS policy — see supabase/migration-training-manager-sales.sql.
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['admin'],
  '/crm': ['admin', 'sales', 'training_manager'],
  '/leads': ['admin', 'sales', 'training_manager'],
  '/meetings': ['admin', 'sales', 'training_manager'],
  '/sales': ['admin', 'sales', 'training_manager'],
  '/customers': ['admin', 'sales', 'training_manager'],
  '/machines': ['admin'],
  // Sales edit the calculator catalog: it is their pitch, and the numbers move
  // per campaign. The matching RLS policy has to allow it too — see
  // supabase/migration-roi-catalog-sales-write.sql. Deliberately NOT opened to
  // training_manager: this price list is the public calculator's, not one
  // customer's.
  '/roi-catalog': ['admin', 'sales'],
  '/roi-customers': ['admin', 'sales', 'training_manager'],
  '/installations': ['admin', 'technician'],
  '/training': ['admin', 'training_manager'],
  '/users': ['admin'],
  '/settings': ['admin'],
  '/reports': ['admin'], // per-report gating below; admins only via role
}

export function canVisit(path: string, role: UserRole): boolean {
  return (ROUTE_ROLES[path] ?? ['admin']).includes(role)
}

export function defaultRoute(role: UserRole): string {
  if (role === 'sales') return '/crm'
  if (role === 'technician') return '/installations'
  if (role === 'training_manager') return '/training'
  return '/'
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'מנהל ראשי',
  sales: 'מכירות',
  technician: 'טכנאי/ת',
  training_manager: 'מנהל/ת הדרכות',
}

/** Roles that can be tied to a sales_persons record, and so carry their own
 *  book of leads. Admins are excluded on purpose: they see everything. */
export function canLinkSalesPerson(role: UserRole): boolean {
  return role === 'sales' || role === 'training_manager'
}

/**
 * The salesperson whose records this user is limited to, or null when they see
 * everything. Keeps "only mine" in one place: admins always see the lot, and
 * anyone else linked to a salesperson sees only what is assigned to them.
 * A non-admin with no link still sees everything — that is a setup gap, so
 * check the link in משתמשים rather than relying on it to hide anything.
 */
export function ownSalesPersonId(
  role: UserRole,
  salesPersonId: string | null | undefined,
): string | null {
  return role !== 'admin' && salesPersonId ? salesPersonId : null
}

// ── Per-report permissions ──
export type ReportKey =
  | 'monthly_target'
  | 'sales_by_person'
  | 'installations_pending'
  | 'leads_archived_meeting'

export const REPORT_LABEL: Record<ReportKey, string> = {
  monthly_target: 'יעד חודשי',
  sales_by_person: 'מכירות לפי איש מכירות',
  installations_pending: 'התקנות ממתינות',
  leads_archived_meeting: 'לידים בארכיון בשלב פגישה',
}

export function canViewReport(
  role: UserRole,
  perms: string[] | null | undefined,
  key: ReportKey,
): boolean {
  return role === 'admin' || !!perms?.includes(key)
}

export function canViewAnyReport(role: UserRole, perms: string[] | null | undefined): boolean {
  return role === 'admin' || (perms?.length ?? 0) > 0
}
