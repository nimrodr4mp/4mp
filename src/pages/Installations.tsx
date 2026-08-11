import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { fetchAllPages, supabase } from '../lib/supabase'
import { formatDate, generateId, localDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { Installation, InstallationStatus } from '../types'

const STATUS_VARIANT: Record<InstallationStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
}

const emptyForm = {
  customer_name: '',
  phone: '',
  city: '',
  address: '',
  machine_id: '',
  serial_number: '',
  technician_id: '',
  planned_date: '',
  status: 'pending' as InstallationStatus,
  notes: '',
}

export default function Installations() {
  const { role, user } = useAuth()
  const { machines, appUsers } = useAppData()
  const [installations, setInstallations] = useState<Installation[]>([])
  const [technicianFilter, setTechnicianFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Installation | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const technicians = appUsers.filter((u) => u.role === 'technician')

  useEffect(() => {
    void loadInstallations()
  }, [role, user, technicianFilter, statusFilter])

  async function loadInstallations() {
    const data = await fetchAllPages<Installation>((from, to) => {
      let query = supabase.from('installations').select('*')
      if (role === 'technician' && user) {
        query = query.eq('technician_id', user.id)
      } else if (technicianFilter) {
        query = query.eq('technician_id', technicianFilter)
      }
      if (statusFilter) query = query.eq('status', statusFilter)
      return query.order('planned_date', { ascending: true }).range(from, to)
    })
    setInstallations(data)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(installation: Installation) {
    setEditing(installation)
    setForm({
      customer_name: installation.customer_name,
      phone: installation.phone ?? '',
      city: installation.city ?? '',
      address: installation.address ?? '',
      machine_id: installation.machine_id ?? '',
      serial_number: installation.serial_number ?? '',
      technician_id: installation.technician_id ?? '',
      planned_date: installation.planned_date ?? '',
      status: installation.status,
      notes: installation.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        customer_name: form.customer_name,
        phone: form.phone || null,
        city: form.city || null,
        address: form.address || null,
        machine_id: form.machine_id || null,
        machine_name: machines.find((m) => m.id === form.machine_id)?.name ?? null,
        serial_number: form.serial_number || null,
        technician_id: form.technician_id || null,
        planned_date: form.planned_date || null,
        status: form.status,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        await supabase.from('installations').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('installations').insert({ id: generateId(), ...payload })
      }
      setModalOpen(false)
      void loadInstallations()
    } finally {
      setIsSaving(false)
    }
  }

  async function markStatus(installation: Installation, newStatus: InstallationStatus) {
    const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'completed') payload.actual_date = localDate()
    await supabase.from('installations').update(payload).eq('id', installation.id)
    void loadInstallations()
  }

  const grouped = installations.reduce<Record<string, Installation[]>>((acc, i) => {
    const key = i.planned_date ?? HE.common.noData
    acc[key] = acc[key] ?? []
    acc[key].push(i)
    return acc
  }, {})

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{HE.installations.title}</h1>
        {role === 'admin' && (
          <Button onClick={openNew}>
            <Plus size={16} /> {HE.installations.addInstallation}
          </Button>
        )}
      </div>

      {role === 'admin' && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <Select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="w-48"
          >
            <option value="">{HE.installations.technician}</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">{HE.common.status}</option>
            {Object.entries(HE.installationStatus).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {installations.length === 0 && (
        <p className="text-sm text-gray-400">{HE.installations.noInstallations}</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="mb-2 text-sm font-semibold text-gray-500">{formatDate(date)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((installation) => (
                <Card key={installation.id} className="p-4">
                  <div
                    className="mb-2 flex cursor-pointer items-center justify-between"
                    onClick={() => role === 'admin' && openEdit(installation)}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {installation.customer_name}
                    </span>
                    <Badge variant={STATUS_VARIANT[installation.status]}>
                      {HE.installationStatus[installation.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{installation.machine_name}</p>
                  {installation.serial_number && (
                    <p className="text-xs text-gray-400">
                      {HE.installations.serialNumber}: {installation.serial_number}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {installation.city} {installation.address}
                  </p>
                  {installation.notes && (
                    <p className="mt-1 text-xs text-gray-500">{installation.notes}</p>
                  )}
                  {role === 'technician' && installation.status !== 'completed' && installation.status !== 'cancelled' && (
                    <div className="mt-2 flex gap-2">
                      <Button size="xs" onClick={() => void markStatus(installation, 'completed')}>
                        {HE.installations.markCompleted}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void markStatus(installation, 'cancelled')}
                      >
                        {HE.installations.markCancelled}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? HE.installations.editInstallation : HE.installations.addInstallation}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.common.name}
            required
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={HE.common.phone}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={HE.common.city}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <Input
            label={HE.common.address}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={HE.installations.machine}
              value={form.machine_id}
              onChange={(e) => setForm((f) => ({ ...f, machine_id: e.target.value }))}
            >
              <option value="">-</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Input
              label={HE.installations.serialNumber}
              value={form.serial_number}
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={HE.installations.technician}
              value={form.technician_id}
              onChange={(e) => setForm((f) => ({ ...f, technician_id: e.target.value }))}
            >
              <option value="">-</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Input
              label={HE.installations.plannedDate}
              type="date"
              value={form.planned_date}
              onChange={(e) => setForm((f) => ({ ...f, planned_date: e.target.value }))}
            />
          </div>
          <Select
            label={HE.common.status}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InstallationStatus }))}
          >
            {Object.entries(HE.installationStatus).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{HE.common.notes}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>
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
    </div>
  )
}
