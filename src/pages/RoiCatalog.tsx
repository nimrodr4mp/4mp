import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, RotateCcw } from 'lucide-react'
import { supabase, selectAll } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { HE } from '../constants/hebrew'

/**
 * The device/treatment catalog behind the public ROI calculator.
 *
 * These are the numbers every prospect sees, so edits here are immediately
 * public — /api/roi-catalog serves this table with no login. That is why the
 * screen saves explicitly on a button rather than autosaving as you type.
 *
 * Rows are edited locally and written in one pass on save. Deletes are applied
 * on save too, so a mis-click is recoverable with "ביטול שינויים" right up
 * until then.
 */

interface DeviceRow {
  id: string
  name: string
  short_name: string
  category: string
  price: number
  sort_order: number
  is_active: boolean
}

interface TreatmentRow {
  id: string
  device_id: string
  name: string
  price: number
  monthly_clients: number
  sort_order: number
}

/** Ids are TEXT and human-readable in the seed data; keep new ones in that style. */
function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function num(v: string): number {
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export default function RoiCatalog() {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [treatments, setTreatments] = useState<TreatmentRow[]>([])
  const [removedDevices, setRemovedDevices] = useState<string[]>([])
  const [removedTreatments, setRemovedTreatments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [d, t] = await Promise.all([
        selectAll<DeviceRow>('roi_devices', '*', 'sort_order'),
        selectAll<TreatmentRow>('roi_treatments', '*', 'sort_order'),
      ])
      setDevices(d)
      setTreatments(t)
      setRemovedDevices([])
      setRemovedTreatments([])
      setDirty(false)
    } catch {
      setError(HE.roiCatalog.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  function patchDevice(id: string, patch: Partial<DeviceRow>) {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
    setDirty(true)
  }

  function patchTreatment(id: string, patch: Partial<TreatmentRow>) {
    setTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    setDirty(true)
  }

  function addDevice() {
    const id = newId('dev')
    setDevices((prev) => [
      ...prev,
      {
        id,
        name: '',
        short_name: '',
        category: '',
        price: 0,
        sort_order: prev.length + 1,
        is_active: true,
      },
    ])
    setDirty(true)
  }

  function addTreatment(deviceId: string) {
    setTreatments((prev) => [
      ...prev,
      {
        id: newId('trt'),
        device_id: deviceId,
        name: '',
        price: 0,
        monthly_clients: 0,
        sort_order: prev.filter((t) => t.device_id === deviceId).length + 1,
      },
    ])
    setDirty(true)
  }

  function removeDevice(id: string) {
    if (!confirm(HE.roiCatalog.confirmDeleteDevice)) return
    setDevices((prev) => prev.filter((d) => d.id !== id))
    // Treatments go with it; the FK cascades server-side, but the local view
    // has to match or the UI would show orphans until the next reload.
    setTreatments((prev) => prev.filter((t) => t.device_id !== id))
    setRemovedDevices((prev) => [...prev, id])
    setDirty(true)
  }

  function removeTreatment(id: string) {
    setTreatments((prev) => prev.filter((t) => t.id !== id))
    setRemovedTreatments((prev) => [...prev, id])
    setDirty(true)
  }

  function validate(): string {
    if (devices.some((d) => !d.name.trim() || !d.short_name.trim())) {
      return HE.roiCatalog.errorDeviceName
    }
    if (treatments.some((t) => !t.name.trim())) return HE.roiCatalog.errorTreatmentName
    return ''
  }

  async function save() {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      // Deletes first: a device removed and its id reused in the same session
      // would otherwise resurrect as an upsert against the row being deleted.
      if (removedTreatments.length) {
        const { error: e } = await supabase.from('roi_treatments').delete().in('id', removedTreatments)
        if (e) throw e
      }
      if (removedDevices.length) {
        const { error: e } = await supabase.from('roi_devices').delete().in('id', removedDevices)
        if (e) throw e
      }
      if (devices.length) {
        const { error: e } = await supabase.from('roi_devices').upsert(
          devices.map((d, i) => ({ ...d, sort_order: i + 1, updated_at: new Date().toISOString() })),
        )
        if (e) throw e
      }
      if (treatments.length) {
        const { error: e } = await supabase.from('roi_treatments').upsert(
          treatments.map((t) => ({ ...t, updated_at: new Date().toISOString() })),
        )
        if (e) throw e
      }
      setRemovedDevices([])
      setRemovedTreatments([])
      setDirty(false)
      setSavedAt(new Date())
      await load()
    } catch (e) {
      // RLS rejects writes from anyone the policy does not allow; say so plainly
      // instead of showing a raw PostgREST error.
      const msg = (e as { message?: string })?.message ?? ''
      setError(/row-level security|permission denied/i.test(msg) ? HE.roiCatalog.errorNotAllowed : HE.roiCatalog.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-400">{HE.common.loading}</p>

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{HE.roiCatalog.title}</h1>
          <p className="mt-1 text-sm text-gray-500">{HE.roiCatalog.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-700">
              {HE.roiCatalog.saved} {savedAt.toLocaleTimeString('he-IL')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={saving || !dirty}>
            <RotateCcw size={15} />
            {HE.roiCatalog.discard}
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving} disabled={!dirty}>
            <Save size={15} />
            {HE.common.save}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {devices.map((d, i) => {
          const rows = treatments.filter((t) => t.device_id === d.id)
          const fullCapacity = rows.reduce((a, t) => a + t.price * t.monthly_clients, 0)
          return (
            <Card key={d.id} className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Badge variant="outline">
                  {String(i + 1).padStart(2, '0')} — {HE.roiCatalog.device}
                </Badge>
                <Button variant="ghost" size="xs" onClick={() => removeDevice(d.id)}>
                  <Trash2 size={14} />
                  {HE.common.delete}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Input
                  label={HE.roiCatalog.fullName}
                  value={d.name}
                  onChange={(e) => patchDevice(d.id, { name: e.target.value })}
                />
                <Input
                  label={HE.roiCatalog.shortName}
                  value={d.short_name}
                  onChange={(e) => patchDevice(d.id, { short_name: e.target.value })}
                />
                <Input
                  label={HE.roiCatalog.category}
                  value={d.category}
                  onChange={(e) => patchDevice(d.id, { category: e.target.value })}
                />
                <Input
                  label={HE.roiCatalog.devicePrice}
                  dir="ltr"
                  inputMode="decimal"
                  value={String(d.price)}
                  onChange={(e) => patchDevice(d.id, { price: num(e.target.value) })}
                />
              </div>

              <label className="mt-3 flex w-fit items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={d.is_active}
                  onChange={(e) => patchDevice(d.id, { is_active: e.target.checked })}
                />
                {HE.roiCatalog.isActive}
              </label>

              <div className="mt-4 border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    {HE.roiCatalog.treatments} ({rows.length})
                  </h3>
                  <span className="text-xs text-gray-500">
                    {HE.roiCatalog.fullCapacity}: ₪{Math.round(fullCapacity).toLocaleString('he-IL')}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {rows.map((t) => (
                    <div key={t.id} className="grid grid-cols-1 items-end gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                      <Input
                        placeholder={HE.roiCatalog.treatmentName}
                        value={t.name}
                        onChange={(e) => patchTreatment(t.id, { name: e.target.value })}
                      />
                      <Input
                        placeholder={HE.roiCatalog.treatmentPrice}
                        dir="ltr"
                        inputMode="decimal"
                        value={String(t.price)}
                        onChange={(e) => patchTreatment(t.id, { price: num(e.target.value) })}
                      />
                      <Input
                        placeholder={HE.roiCatalog.monthlyClients}
                        dir="ltr"
                        inputMode="decimal"
                        value={String(t.monthly_clients)}
                        onChange={(e) => patchTreatment(t.id, { monthly_clients: num(e.target.value) })}
                      />
                      <Button variant="ghost" size="xs" onClick={() => removeTreatment(t.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <p className="text-xs text-gray-400">{HE.roiCatalog.noTreatments}</p>
                  )}
                </div>

                <Button variant="outline" size="xs" className="mt-3" onClick={() => addTreatment(d.id)}>
                  <Plus size={14} />
                  {HE.roiCatalog.addTreatment}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Button variant="outline" className="mt-4" onClick={addDevice}>
        <Plus size={16} />
        {HE.roiCatalog.addDevice}
      </Button>
    </div>
  )
}
