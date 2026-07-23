import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { AppShell } from './components/layout/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CrmDashboard from './pages/CrmDashboard'
import Leads from './pages/Leads'
import Meetings from './pages/Meetings'
import Machines from './pages/Machines'
import Customers from './pages/Customers'
import Sales from './pages/Sales'
import Installations from './pages/Installations'
import Training from './pages/Training'
import Reports from './pages/Reports'
import UserManagement from './pages/UserManagement'
import SettingsPage from './pages/Settings'
import NotFound from './pages/NotFound'

function LoginRoute() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/crm" element={<CrmDashboard />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/installations" element={<Installations />} />
        <Route path="/training" element={<Training />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
