import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearToken, decodeToken, getToken, setToken, type TokenClaims } from '../lib/auth'
import type { AppUser, UserRole } from '../types'

interface AuthContextValue {
  user: AppUser | null
  role: UserRole | null
  isRealAdmin: boolean
  viewAsRole: UserRole | null
  setViewAsRole: (role: UserRole | null) => void
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function userFromClaims(c: TokenClaims): AppUser {
  return {
    id: c.sub,
    email: c.email,
    name: c.name,
    role: c.app_role,
    is_active: true,
    sales_person_id: c.sales_person_id ?? null,
    report_permissions: c.report_permissions ?? [],
    created_at: '',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null)

  useEffect(() => {
    const token = getToken()
    if (token) {
      const claims = decodeToken(token)
      if (claims && (!claims.exp || claims.exp * 1000 > Date.now())) {
        setUser(userFromClaims(claims))
      } else {
        clearToken()
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('invalid_credentials')
    const { token } = (await res.json()) as { token: string }
    const claims = decodeToken(token)
    if (!claims) throw new Error('invalid_credentials')
    setToken(token)
    setUser(userFromClaims(claims))
  }, [])

  const logout = useCallback(async () => {
    clearToken()
    setUser(null)
    setViewAsRole(null)
  }, [])

  const isRealAdmin = user?.role === 'admin'
  const role = isRealAdmin && viewAsRole ? viewAsRole : (user?.role ?? null)

  const value = useMemo(
    () => ({
      user,
      role,
      isRealAdmin,
      viewAsRole,
      setViewAsRole,
      isLoading,
      login,
      logout,
    }),
    [user, role, isRealAdmin, viewAsRole, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
