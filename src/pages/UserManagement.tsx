import { useState } from 'react'
import { Plus, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, generateId } from '../lib/utils'
import { generateSalt, hashPassword } from '../lib/auth'
import { useAppData } from '../context/AppContext'
import { REPORT_LABEL, ROLE_LABEL, type ReportKey } from '../lib/permissions'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { AppUser, UserRole } from '../types'

const ALL_REPORTS = Object.keys(REPORT_LABEL) as ReportKey[]

const emptyForm = {
  name: '',
  email: '',
  role: 'sales' as UserRole,
  sales_person_id: '',
  is_active: true,
  report_permissions: [] as string[],
}

export default function UserManagement() {
  const { appUsers, salesPersons, refreshAppUsers } = useAppData()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(u: AppUser) {
    setEditing(u)
    setForm({
      name: u.name,
      email: u.email,
      role: u.role,
      sales_person_id: u.sales_person_id ?? '',
      is_active: u.is_active,
      report_permissions: u.report_permissions ?? [],
    })
    setModalOpen(true)
  }

  function toggleReportPermission(key: ReportKey) {
    setForm((f) => ({
      ...f,
      report_permissions: f.report_permissions.includes(key)
        ? f.report_permissions.filter((p) => p !== key)
        : [...f.report_permissions, key],
    }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        sales_person_id: form.role === 'sales' ? form.sales_person_id || null : null,
        is_active: form.is_active,
        report_permissions: form.role === 'admin' ? [] : form.report_permissions,
      }
      if (editing) {
        await supabase.from('app_users').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('app_users').insert({ id: generateId(), ...payload })
      }
      setModalOpen(false)
      await refreshAppUsers()
    } finally {
      setIsSaving(false)
    }
  }

  function openPasswordModal(u: AppUser) {
    setPasswordTarget(u)
    setNewPassword('')
    setPasswordModalOpen(true)
  }

  async function handleSetPassword() {
    if (!passwordTarget || !newPassword) return
    setIsSavingPassword(true)
    try {
      const salt = generateSalt()
      const hash = await hashPassword(newPassword, salt)
      await supabase
        .from('app_users')
        .update({ password_hash: hash, password_salt: salt })
        .eq('id', passwordTarget.id)
      setPasswordModalOpen(false)
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.users.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.users.addUser}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.users.userName}</th>
              <th className="px-4 py-3 font-medium">{HE.common.email}</th>
              <th className="px-4 py-3 font-medium">{HE.users.role}</th>
              <th className="px-4 py-3 font-medium">{HE.users.isActive}</th>
              <th className="px-4 py-3 font-medium">{HE.users.lastLogin}</th>
              <th className="px-4 py-3 font-medium">{HE.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {appUsers.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="cursor-pointer px-4 py-3" onClick={() => openEdit(u)}>
                  {u.name}
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">{ROLE_LABEL[u.role]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.is_active ? 'success' : 'default'}>
                    {u.is_active ? HE.common.active : HE.common.inactive}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {u.last_login ? formatDate(u.last_login) : HE.users.neverLoggedIn}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" onClick={() => openPasswordModal(u)}>
                      <KeyRound size={13} /> {HE.users.setPassword}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {appUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {HE.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? HE.users.editUser : HE.users.addUser}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.users.userName}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label={HE.common.email}
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Select
            label={HE.users.role}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
          >
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
          {form.role === 'sales' && (
            <Select
              label={HE.users.linkSalesPerson}
              value={form.sales_person_id}
              onChange={(e) => setForm((f) => ({ ...f, sales_person_id: e.target.value }))}
            >
              <option value="">-</option>
              {salesPersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </Select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            {HE.common.active}
          </label>

          {form.role !== 'admin' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {HE.users.reportPermissions}
              </label>
              <div className="flex flex-col gap-1.5">
                {ALL_REPORTS.map((key) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.report_permissions.includes(key)}
                      onChange={() => toggleReportPermission(key)}
                    />
                    {REPORT_LABEL[key]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {HE.common.cancel}
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              {HE.common.save}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        title={HE.users.setPassword}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.users.newPassword}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="outline" onClick={() => setPasswordModalOpen(false)}>
              {HE.common.cancel}
            </Button>
            <Button onClick={handleSetPassword} loading={isSavingPassword} disabled={!newPassword}>
              {HE.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
