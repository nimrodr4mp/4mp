import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canViewAnyReport, canVisit, defaultRoute } from '../../lib/permissions'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  const { user, role, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null

  if (!user || !role) {
    return <Navigate to="/login" replace />
  }

  const allowed =
    location.pathname === '/reports'
      ? canViewAnyReport(role, user.report_permissions)
      : canVisit(location.pathname, role)

  if (!allowed) {
    return <Navigate to={defaultRoute(role)} replace />
  }

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
