import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, generateId } from '../lib/utils'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { BusinessType, Customer, Installation, Sale } from '../types'

const emptyForm = {
  name: '',
  type: 'clinic' as BusinessType,
  contact_name: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  notes: '',
}

export default function Customers() {
  const { customers, refreshCustomers } = useAppData()
  const [machineCounts, setMachineCounts] = useState<Record<string, number>>({})
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [detailSales, setDetailSales] = useState<Sale[]>([])
  const [detailInstallations, setDetailInstallations] = useState<Installation[]>([])
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void loadMachineCounts()
  }, [customers])

  async function loadMachineCounts() {
    const { data } = await supabase.from('sales').select('customer_id, machines')
    const counts: Record<string, Set<string>> = {}
    for (const row of data ?? []) {
      if (!row.customer_id) continue
      const set = counts[row.customer_id] ?? new Set<string>()
      for (const line of row.machines ?? []) {
        if (line.machine_id) set.add(line.machine_id)
      }
      counts[row.customer_id] = set
    }
    const result: Record<string, number> = {}
    for (const [id, set] of Object.entries(counts)) result[id] = set.size
    setMachineCounts(result)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setEditModalOpen(true)
  }

  function openEditFromDetail() {
    if (!detailCustomer) return
    setEditing(detailCustomer)
    setForm({
      name: detailCustomer.name,
      type: detailCustomer.type,
      contact_name: detailCustomer.contact_name ?? '',
      phone: detailCustomer.phone ?? '',
      email: detailCustomer.email ?? '',
      city: detailCustomer.city ?? '',
      address: detailCustomer.address ?? '',
      notes: detailCustomer.notes ?? '',
    })
    setDetailOpen(false)
    setEditModalOpen(true)
  }

  async function openDetail(customer: Customer) {
    setDetailCustomer(customer)
    setDetailOpen(true)
    const [salesRes, installationsRes] = await Promise.all([
      supabase.from('sales').select('*').eq('customer_id', customer.id).order('date', { ascending: false }),
      supabase
        .from('installations')
        .select('*')
        .eq('customer_id', customer.id)
        .order('planned_date', { ascending: false }),
    ])
    setDetailSales((salesRes.data as Sale[]) ?? [])
    setDetailInstallations((installationsRes.data as Installation[]) ?? [])
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        type: form.type,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
        city: form.city || null,
        address: form.address || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        await supabase.from('customers').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('customers').insert({ id: generateId(), ...payload })
      }
      setEditModalOpen(false)
      await refreshCustomers()
    } finally {
      setIsSaving(false)
    }
  }

  const typeVariant: Record<BusinessType, 'info' | 'default'> = {
    clinic: 'info',
    doctor: 'default',
    cosmetician: 'default',
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.customers.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.customers.addCustomer}
        </Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.common.name}</th>
              <th className="px-4 py-3 font-medium">{HE.customers.customerType}</th>
              <th className="px-4 py-3 font-medium">{HE.customers.contactName}</th>
              <th className="px-4 py-3 font-medium">{HE.common.phone}</th>
              <th className="px-4 py-3 font-medium">{HE.common.city}</th>
              <th className="px-4 py-3 font-medium">{HE.customers.machineCount}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                onClick={() => void openDetail(c)}
                className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">
                  <Badge variant={typeVariant[c.type]}>{HE.businessType[c.type]}</Badge>
                </td>
                <td className="px-4 py-3">{c.contact_name}</td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.city}</td>
                <td className="px-4 py-3">{machineCounts[c.id] ?? 0}</td>
              </tr>
            ))}
            {customers.length === 0 && (
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
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailCustomer?.name}
        size="lg"
      >
        {detailCustomer && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p>
                <span className="text-gray-400">{HE.customers.customerType}: </span>
                {HE.businessType[detailCustomer.type]}
              </p>
              <p>
                <span className="text-gray-400">{HE.customers.contactName}: </span>
                {detailCustomer.contact_name || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.phone}: </span>
                {detailCustomer.phone || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.email}: </span>
                {detailCustomer.email || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.city}: </span>
                {detailCustomer.city || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.address}: </span>
                {detailCustomer.address || '—'}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">{HE.customers.salesHistory}</p>
              <div className="flex flex-col gap-2">
                {detailSales.map((s) => (
                  <div key={s.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                    <span>{formatDate(s.date)}</span>
                    <span>₪{s.total_amount.toLocaleString('he-IL')}</span>
                    <Badge variant="info">{HE.saleStatus[s.status]}</Badge>
                  </div>
                ))}
                {detailSales.length === 0 && (
                  <p className="text-xs text-gray-400">{HE.common.noData}</p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">
                {HE.customers.installationsHistory}
              </p>
              <div className="flex flex-col gap-2">
                {detailInstallations.map((i) => (
                  <div key={i.id} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                    <span>{i.machine_name}</span>
                    <span>{formatDate(i.planned_date)}</span>
                    <Badge variant="info">{HE.installationStatus[i.status]}</Badge>
                  </div>
                ))}
                {detailInstallations.length === 0 && (
                  <p className="text-xs text-gray-400">{HE.common.noData}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                {HE.common.close}
              </Button>
              <Button onClick={openEditFromDetail}>{HE.common.edit}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={editing ? HE.customers.editCustomer : HE.customers.addCustomer}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.common.name}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label={HE.customers.customerType}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BusinessType }))}
          >
            {Object.entries(HE.businessType).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label={HE.customers.contactName}
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={HE.common.phone}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label={HE.common.email}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={HE.common.city}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              label={HE.common.address}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
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
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
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
