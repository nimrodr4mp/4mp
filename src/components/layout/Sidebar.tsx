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
  FileBarChart,
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
]

const manageItems: NavItem[] = [
  { path: '/', label: HE.nav.dashboard, icon: LayoutDashboard },
  { path: '/machines', label: HE.nav.machines, icon: Wrench },
  { path: '/installations', label: HE.nav.installations, icon: Hammer },
  { path: '/reports', label: HE.nav.reports, icon: FileBarChart },
  { path: '/users', label: HE.nav.users, icon: Users2 },
  { path: '/settings', label: HE.nav.settings, icon: Settings },
]

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
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

export function Sidebar() {
  return (
    <aside dir="rtl" className="flex h-screen w-60 flex-col bg-gray-900 px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="rounded-lg bg-white p-1.5">
          <img src="/logo.png" alt="4MP" className="h-8 w-auto" />
        </div>
        <span className="text-sm font-semibold text-white">{HE.app.subtitle}</span>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <NavSection title={HE.nav.salesSection} items={salesItems} />
        <NavSection title={HE.nav.manageSection} items={manageItems} />
      </nav>
    </aside>
  )
}
