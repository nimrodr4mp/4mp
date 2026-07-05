import { LogOut, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABEL, defaultRoute, type UserRole } from '../../lib/permissions'
import { HE } from '../../constants/hebrew'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'

const ALL_ROLES: UserRole[] = ['admin', 'sales', 'technician']

export function TopBar() {
  const { user, role, isRealAdmin, viewAsRole, setViewAsRole, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleViewAsChange(value: string) {
    const nextRole = value === '' ? null : (value as UserRole)
    setViewAsRole(nextRole)
    navigate(defaultRoute(nextRole ?? user!.role), { replace: true })
  }

  return (
    <header
      dir="rtl"
      className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6"
    >
      <div>
        {isRealAdmin && (
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-gray-400" />
            <Select
              value={viewAsRole ?? ''}
              onChange={(e) => handleViewAsChange(e.target.value)}
              className="py-1 text-xs"
            >
              <option value="">{HE.common.viewAsRole}</option>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
            {viewAsRole && (
              <button
                onClick={() => handleViewAsChange('')}
                className="text-xs text-primary-600 hover:underline"
              >
                {HE.common.backToAdmin}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-700">
          <span className="font-medium">{user?.name}</span>
          {role && <span className="mr-2 text-gray-400">· {ROLE_LABEL[role]}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut size={16} />
          {HE.common.logout}
        </Button>
      </div>
    </header>
  )
}
