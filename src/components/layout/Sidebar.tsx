import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users2,
  UserCircle,
  Contact,
  CalendarClock,
  ShoppingCart,
  Building2,
  Wrench,
  Hammer,
  GraduationCap,
  FileBarChart,
  Calculator,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canViewAnyReport, canVisit } from '../../lib/permissions'
import { HE } from '../../constants/hebrew'
import { cn } from '../../lib/utils'

interface NavItem {
  path: string
  label: string
  icon: typeof LayoutDashboard
}

const salesItems: NavItem[] = [
  { path: '/crm', label: HE.nav.crm, icon: Contact },
  { path: '/leads', label: HE.nav.leads, icon: UserCircle },
  { path: '/meetings', label: HE.nav.meetings, icon: CalendarClock },
  { path: '/sales', label: HE.nav.sales, icon: ShoppingCart },
  { path: '/customers', label: HE.nav.customers, icon: Building2 },
  { path: '/roi-customers', label: HE.nav.roiCustomers, icon: Calculator },
]

const manageItems: NavItem[] = [
  { path: '/', label: HE.nav.dashboard, icon: LayoutDashboard },
  { path: '/machines', label: HE.nav.machines, icon: Wrench },
  { path: '/roi-catalog', label: HE.nav.roiCatalog, icon: Calculator },
  { path: '/installations', label: HE.nav.installations, icon: Hammer },
  { path: '/training', label: HE.nav.training, icon: GraduationCap },
  { path: '/reports', label: HE.nav.reports, icon: FileBarChart },
  { path: '/users', label: HE.nav.users, icon: Users2 },
  { path: '/settings', label: HE.nav.settings, icon: Settings },
]

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string
  items: NavItem[]
  onNavigate: () => void
}) {
  const { role, user } = useAuth()
  if (!role) return null

  const visible = items.filter((item) =>
    item.path === '/reports'
      ? canViewAnyReport(role, user?.report_permissions)
      : canVisit(item.path, role),
  )

  if (visible.length === 0) return null

  return (
    <div className="mb-6">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {visible.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        dir="rtl"
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-64 flex-col bg-gray-900 px-3 py-4',
          'transition-transform duration-200 ease-out',
          'lg:static lg:z-auto lg:w-60 lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="rounded-lg bg-white p-1.5">
            <img src="/logo.png" alt="4MP" className="h-8 w-auto" />
          </div>
          <span className="text-sm font-semibold text-white">{HE.app.subtitle}</span>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <NavSection title={HE.nav.salesSection} items={salesItems} onNavigate={onClose} />
          <NavSection title={HE.nav.manageSection} items={manageItems} onNavigate={onClose} />
        </nav>
      </aside>
    </>
  )
}
