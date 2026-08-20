import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ExternalLink, RotateCcw, Save } from 'lucide-react'
import { supabase, selectAll } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { HE } from '../constants/hebrew'
import { roiCalculatorLink, type RoiScenario, type RoiUser } from '../lib/roi'

/**
 * Registrants of the public calculator, and the per-customer catalog.
 *
 * The rule this screen exists to express: a customer with no rows here sees the
 * shared catalog exactly as before. Picking even one device switches them to a
 * tailored list. Empty price/clients fields mean "inherit from the catalog", so
 * a later global price change still reaches them — only an explicit number
 * stays fixed.
 */

interface Device {
  id: string
  name: string
  short_name: string
  category: string
  price: number
  is_active: boolean
  sort_order: number
}
interface Treatment {
  id: string
  device_id: string
  name: string
  price: number
  monthly_clients: number
  sort_order: number
}
interface UserDevice {
  roi_user_id: string
  device_id: string
  price: number | null
  sort_order: number
}
interface UserTreatment {
  roi_user_id: string
  treatment_id: string
  price: number | null
  monthly_clients: number | null
  is_hidden: boolean
}

/** '' means inherit; anything else is an explicit override. */
function toNum(v: string): number | null {
  const s = v.trim()
  if (s === '') return null
  const n = Number(s.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
function fromNum(v: number | null): string {
  return v === null || v === undefined ? '' : String(v)
}

export default function RoiCustomers() {
  const [users, setUsers] = useState<RoiUser[]>([])
  const [scenarios, setScenarios] = useState<RoiScenario[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [selected, setSelected] = useState<RoiUser | null>(null)

  const [userDevices, setUserDevices] = useState<UserDevice[]>([])
  const [userTreatments, setUserTreatments] = useState<UserTreatment[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [u, s, d, t] = await Promise.all([
        selectAll<RoiUser>('roi_users', '*', 'created_at'),
        selectAll<RoiScenario>('roi_scenarios', '*'),
        selectAll<Device>('roi_devices', '*', 'sort_order'),
        selectAll<Treatment>('roi_treatments', '*', 'sort_order'),
      ])
      setUsers([...u].reverse())
      setScenarios(s)
      setDevices(d)
      setTreatments(t)
    } catch {
      setError(HE.roiCustomers.loadFailed)
    } finally {
      setLoading(false)
    }
  }

  async function openCustomer(u: RoiUser) {
    setSelected(u)
    setError('')
    setDirty(false)
    try {
      const [ud, ut] = await Promise.all([
        supabase.from('roi_user_devices').select('*').eq('roi_user_id', u.id),
        supabase.from('roi_user_treatments').select('*').eq('roi_user_id', u.id),
      ])
      if (ud.error) throw ud.error
      if (ut.error) throw ut.error
      setUserDevices((ud.data ?? []) as UserDevice[])
      setUserTreatments((ut.data ?? []) as UserTreatment[])
    } catch {
      setError(HE.roiCustomers.loadFailed)
      setUserDevices([])
      setUserTreatments([])
    }
  }

  const scenarioFor = useMemo(() => {
    const map = new Map<string, RoiScenario>()
    for (const s of scenarios) map.set(s.roi_user_id, s)
    return map
  }, [scenarios])

  const tailored = userDevices.length > 0

  function toggleDevice(deviceId: string) {
    setUserDevices((prev) => {
      const has = prev.some((d) => d.device_id === deviceId)
      if (has) return prev.filter((d) => d.device_id !== deviceId)
      return [
        ...prev,
        { roi_user_id: selected!.id, device_id: deviceId, price: null, sort_order: prev.length + 1 },
      ]
    })
    setDirty(true)
  }

  function setDevicePrice(deviceId: string, value: string) {
    setUserDevices((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, price: toNum(value) } : d)),
    )
    setDirty(true)
  }

  function patchTreatment(treatmentId: string, patch: Partial<UserTreatment>) {
    setUserTreatments((prev) => {
      const existing = prev.find((t) => t.treatment_id === treatmentId)
      if (existing) {
        return prev.map((t) => (t.treatment_id === treatmentId ? { ...t, ...patch } : t))
      }
      return [
        ...prev,
        {
          roi_user_id: selected!.id,
          treatment_id: treatmentId,
          price: null,
          monthly_clients: null,
          is_hidden: false,
          ...patch,
        },
      ]
    })
    setDirty(true)
  }

  function resetToDefault() {
    if (!confirm(HE.roiCustomers.confirmReset)) return
    setUserDevices([])
    setUserTreatments([])
    setDirty(true)
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      // Replace wholesale: the row counts are tiny, and a diff would risk
      // leaving behind an override for a device no longer selected.
      const delD = await supabase.from('roi_user_devices').delete().eq('roi_user_id', selected.id)
      if (delD.error) throw delD.error
      const delT = await supabase.from('roi_user_treatments').delete().eq('roi_user_id', selected.id)
      if (delT.error) throw delT.error

      if (userDevices.length) {
        const ins = await supabase.from('roi_user_devices').insert(
          userDevices.map((d, i) => ({ ...d, roi_user_id: selected.id, sort_order: i + 1 })),
        )
        if (ins.error) throw ins.error
      }
      // An all-inherit row carries no information; dropping it keeps the table
      // meaningful and makes "is this customer tailored?" honest.
      const meaningful = userTreatments.filter(
        (t) => t.is_hidden || t.price !== null || t.monthly_clients !== null,
      )
      if (meaningful.length) {
        const ins = await supabase.from('roi_user_treatments').insert(
          meaningful.map((t) => ({ ...t, roi_user_id: selected.id })),
        )
        if (ins.error) throw ins.error
      }
      setDirty(false)
      await openCustomer(selected)
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? ''
      setError(
        /row-level security|permission denied/i.test(msg)
          ? HE.roiCustomers.errorNotAllowed
          : /relation .* does not exist|does not exist/i.test(msg)
            ? HE.roiCustomers.errorNoTables
            : HE.roiCustomers.saveFailed,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-400">{HE.common.loading}</p>

  // ── List view ──
  if (!selected) {
    return (
      <div className="p-4 md:p-6">
        <h1 className="text-xl font-semibold text-gray-900">{HE.roiCustomers.title}</h1>
        <p className="mt-1 mb-4 text-sm text-gray-500">{HE.roiCustomers.subtitle}</p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">{HE.common.name}</th>
                <th className="px-4 py-3 font-medium">{HE.common.city}</th>
                <th className="px-4 py-3 font-medium">{HE.common.phone}</th>
                <th className="px-4 py-3 font-medium">{HE.roiCustomers.device}</th>
                <th className="px-4 py-3 font-medium">{HE.roiCustomers.payback}</th>
                <th className="px-4 py-3 font-medium">{HE.roiCustomers.updated}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const sc = scenarioFor.get(u.id)
                return (
                  <tr
                    key={u.id}
                    onClick={() => void openCustomer(u)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3">{u.city}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {u.phone}
                    </td>
                    <td className="px-4 py-3">{sc?.device_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {sc?.payback_months != null
                        ? `${sc.payback_months} ${HE.roiCustomers.months}`
                        : sc
                          ? HE.roiCustomers.noPayback
                          : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {sc ? formatDate(sc.updated_at) : formatDate(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <a
                        href={roiCalculatorLink(u.resume_token)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"
                      >
                        <ExternalLink size={13} />
                        {HE.roiCustomers.openCalculator}
                      </a>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {HE.common.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    )
  }

  // ── Per-customer editor ──
  const visibleDevices = devices.filter((d) => d.is_active)
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowRight size={16} />
            {HE.common.back}
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{selected.name}</h1>
            <p className="text-xs text-gray-500">
              {selected.city} · <span dir="ltr">{selected.phone}</span>
            </p>
          </div>
          <Badge variant={tailored ? 'success' : 'outline'}>
            {tailored ? HE.roiCustomers.tailored : HE.roiCustomers.usingDefault}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!tailored && !dirty}>
            <RotateCcw size={15} />
            {HE.roiCustomers.resetDefault}
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

      <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        {HE.roiCustomers.help}
      </p>

      <div className="flex flex-col gap-3">
        {visibleDevices.map((d) => {
          const picked = userDevices.find((x) => x.device_id === d.id)
          const rows = treatments.filter((t) => t.device_id === d.id)
          return (
            <Card key={d.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <input
                    type="checkbox"
                    checked={!!picked}
                    onChange={() => toggleDevice(d.id)}
                  />
                  {d.name}
                  <span className="text-xs font-normal text-gray-400">
                    {HE.roiCustomers.catalogPrice}: ₪{d.price.toLocaleString('he-IL')}
                  </span>
                </label>
                {picked && (
                  <div className="w-44">
                    <Input
                      label={HE.roiCustomers.priceForCustomer}
                      placeholder={HE.roiCustomers.inherit}
                      dir="ltr"
                      inputMode="decimal"
                      value={fromNum(picked.price)}
                      onChange={(e) => setDevicePrice(d.id, e.target.value)}
                    />
                  </div>
                )}
              </div>

              {picked && rows.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-right text-xs text-gray-400">
                        <th className="py-1 font-medium">{HE.roiCustomers.treatment}</th>
                        <th className="py-1 font-medium">{HE.roiCustomers.priceForCustomer}</th>
                        <th className="py-1 font-medium">{HE.roiCustomers.clients}</th>
                        <th className="py-1 font-medium">{HE.roiCustomers.hide}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((t) => {
                        const ov = userTreatments.find((x) => x.treatment_id === t.id)
                        return (
                          <tr key={t.id} className="border-t border-gray-50">
                            <td className="py-2 pl-2">
                              {t.name}
                              <span className="mr-2 text-xs text-gray-400">
                                (₪{t.price.toLocaleString('he-IL')} × {t.monthly_clients})
                              </span>
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                                dir="ltr"
                                inputMode="decimal"
                                placeholder={HE.roiCustomers.inherit}
                                value={fromNum(ov?.price ?? null)}
                                onChange={(e) => patchTreatment(t.id, { price: toNum(e.target.value) })}
                              />
                            </td>
                            <td className="py-2 pl-2">
                              <input
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                                dir="ltr"
                                inputMode="decimal"
                                placeholder={HE.roiCustomers.inherit}
                                value={fromNum(ov?.monthly_clients ?? null)}
                                onChange={(e) =>
                                  patchTreatment(t.id, { monthly_clients: toNum(e.target.value) })
                                }
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="checkbox"
                                checked={!!ov?.is_hidden}
                                onChange={(e) => patchTreatment(t.id, { is_hidden: e.target.checked })}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
