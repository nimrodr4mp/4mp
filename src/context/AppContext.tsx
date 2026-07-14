import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { AppUser, Customer, Machine, MachineCategory, SalesPerson } from '../types'

interface AppContextValue {
  machines: Machine[]
  salesPersons: SalesPerson[]
  appUsers: AppUser[]
  customers: Customer[]
  machineCategories: MachineCategory[]
  isLoading: boolean
  refreshMachines: () => Promise<void>
  refreshSalesPersons: () => Promise<void>
  refreshAppUsers: () => Promise<void>
  refreshCustomers: () => Promise<void>
  refreshMachineCategories: () => Promise<void>
}

const AppDataContext = createContext<AppContextValue | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])
  const [appUsers, setAppUsers] = useState<AppUser[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machineCategories, setMachineCategories] = useState<MachineCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshMachines = useCallback(async () => {
    const { data } = await supabase
      .from('machines')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setMachines((data as Machine[]) ?? [])
  }, [])

  const refreshSalesPersons = useCallback(async () => {
    const { data } = await supabase
      .from('sales_persons')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setSalesPersons((data as SalesPerson[]) ?? [])
  }, [])

  const refreshAppUsers = useCallback(async () => {
    // Column-level grants expose only non-secret columns (no password hash/salt)
    // to any authenticated user; must select them explicitly, not '*', since
    // Postgres rejects '*' when the role lacks privilege on every column.
    const { data } = await supabase
      .from('app_users')
      .select('id,email,name,role,is_active,last_login,sales_person_id,report_permissions,created_at')
      .order('name')
    setAppUsers((data as AppUser[]) ?? [])
  }, [])

  const refreshCustomers = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers((data as Customer[]) ?? [])
  }, [])

  const refreshMachineCategories = useCallback(async () => {
    const { data } = await supabase
      .from('machine_categories')
      .select('*')
      .order('sort_order')
    setMachineCategories((data as MachineCategory[]) ?? [])
  }, [])

  useEffect(() => {
    if (!user) {
      setMachines([])
      setSalesPersons([])
      setAppUsers([])
      setCustomers([])
      setMachineCategories([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all([
      refreshMachines(),
      refreshSalesPersons(),
      refreshAppUsers(),
      refreshCustomers(),
      refreshMachineCategories(),
    ]).finally(() => setIsLoading(false))
  }, [
    user,
    refreshMachines,
    refreshSalesPersons,
    refreshAppUsers,
    refreshCustomers,
    refreshMachineCategories,
  ])

  const value = useMemo(
    () => ({
      machines,
      salesPersons,
      appUsers,
      customers,
      machineCategories,
      isLoading,
      refreshMachines,
      refreshSalesPersons,
      refreshAppUsers,
      refreshCustomers,
      refreshMachineCategories,
    }),
    [
      machines,
      salesPersons,
      appUsers,
      customers,
      machineCategories,
      isLoading,
      refreshMachines,
      refreshSalesPersons,
      refreshAppUsers,
      refreshCustomers,
      refreshMachineCategories,
    ],
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppProvider')
  return ctx
}
