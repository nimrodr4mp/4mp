export type UserRole = 'admin' | 'sales' | 'technician' | 'training_manager'

export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['admin'],
  '/crm': ['admin', 'sales'],
  '/leads': ['admin', 'sales'],
  '/meetings': ['admin', 'sales'],
  '/sales': ['admin', 'sales'],
  '/customers': ['admin', 'sales'],
  '/machines': ['admin'],
  // Sales edit the calculator catalog: it is their pitch, and the numbers move
  // per campaign. The matching RLS policy has to allow it too — see
  // supabase/migration-roi-catalog-sales-write.sql.
  '/roi-catalog': ['admin', 'sales'],
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

// ── Per-report permissions ──
export type ReportKey = 'sales_by_person' | 'installations_pending' | 'leads_archived_meeting'

export const REPORT_LABEL: Record<ReportKey, string> = {
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
