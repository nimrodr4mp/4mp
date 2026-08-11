import { useEffect, useMemo, useState } from 'react'
import { fetchAllPages, supabase } from '../lib/supabase'
import { formatDate, localDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { canViewReport, REPORT_LABEL, type ReportKey } from '../lib/permissions'
import { Card } from '../components/ui/Card'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { LeadModal } from '../components/leads/LeadModal'
import { HE } from '../constants/hebrew'
import type { Installation, InstallationStatus, Lead, Sale } from '../types'

type DateRangePreset = 'week' | '30days' | 'month' | 'custom'

function rangeForPreset(preset: DateRangePreset, customFrom: string, customTo: string) {
  const now = new Date()
  if (preset === 'week') {
    const from = new Date(now)
    from.setDate(now.getDate() - now.getDay())
    return { from: localDate(from), to: localDate(now) }
  }
  if (preset === '30days') {
    const from = new Date(now)
    from.setDate(now.getDate() - 30)
    return { from: localDate(from), to: localDate(now) }
  }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: localDate(from), to: localDate(now) }
  }
  return { from: customFrom, to: customTo }
}

export default function Reports() {
  const { role, user } = useAuth()
  const perms = user?.report_permissions

  const allReports: ReportKey[] = ['sales_by_person', 'installations_pending', 'leads_archived_meeting']
  const visibleReports = useMemo(
    () => allReports.filter((key) => role && canViewReport(role, perms, key)),
    [role, perms],
  )

  const [activeTab, setActiveTab] = useState<ReportKey | null>(visibleReports[0] ?? null)

  useEffect(() => {
    if (!activeTab && visibleReports.length > 0) setActiveTab(visibleReports[0])
  }, [visibleReports, activeTab])

  if (!role || visibleReports.length === 0) {
    return (
      <div dir="rtl">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">{HE.reports.title}</h1>
        <Card className="p-8 text-center text-gray-400">{HE.reports.noPermission}</Card>
      </div>
    )
  }

  return (
    <div dir="rtl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{HE.reports.title}</h1>

      {visibleReports.length > 1 && (
        <div className="mb-4 flex gap-2 border-b border-gray-200">
          {visibleReports.map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px ' +
                (activeTab === key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700')
              }
            >
              {REPORT_LABEL[key]}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'sales_by_person' && <SalesByPersonReport />}
      {activeTab === 'installations_pending' && <InstallationsPendingReport />}
      {activeTab === 'leads_archived_meeting' && <LeadsArchivedMeetingReport />}
    </div>
  )
}

function SalesByPersonReport() {
  const [preset, setPreset] = useState<DateRangePreset>('month')
  const [customFrom, setCustomFrom] = useState(localDate())
  const [customTo, setCustomTo] = useState(localDate())
  const [rows, setRows] = useState<{ name: string; count: number; total: number }[]>([])

  useEffect(() => {
    void load()
  }, [preset, customFrom, customTo])

  async function load() {
    const { from, to } = rangeForPreset(preset, customFrom, customTo)
    const sales = await fetchAllPages<Sale>((rangeFrom, rangeTo) =>
      supabase
        .from('sales')
        .select('*')
        .gte('date', from)
        .lte('date', to)
        .range(rangeFrom, rangeTo)
        .then((res) => ({ data: res.data as Sale[] | null })),
    )

    const grouped: Record<string, { count: number; total: number }> = {}
    for (const sale of sales) {
      const key = sale.sales_person ?? '—'
      grouped[key] = grouped[key] ?? { count: 0, total: 0 }
      grouped[key].count += 1
      grouped[key].total += Number(sale.total_amount ?? 0)
    }
    const result = Object.entries(grouped)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
    setRows(result)
  }

  return (
    <div>
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Select value={preset} onChange={(e) => setPreset(e.target.value as DateRangePreset)} className="w-40">
          <option value="week">{HE.reports.thisWeek}</option>
          <option value="30days">{HE.reports.last30Days}</option>
          <option value="month">{HE.reports.monthToDate}</option>
          <option value="custom">{HE.reports.custom}</option>
        </Select>
        {preset === 'custom' && (
          <>
            <Input
              label={HE.reports.from}
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <Input
              label={HE.reports.to}
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.reports.salesByPerson.salesperson}</th>
              <th className="px-4 py-3 font-medium">{HE.reports.salesByPerson.dealCount}</th>
              <th className="px-4 py-3 font-medium">{HE.reports.salesByPerson.totalAmount}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-gray-100">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.count}</td>
                <td className="px-4 py-3">₪{row.total.toLocaleString('he-IL')}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
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

function InstallationsPendingReport() {
  const { appUsers } = useAppData()
  const [rows, setRows] = useState<Installation[]>([])

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const data = await fetchAllPages<Installation>((from, to) =>
      supabase
        .from('installations')
        .select('*')
        .in('status', ['pending', 'scheduled'])
        .range(from, to)
        .then((res) => ({ data: res.data as Installation[] | null })),
    )
    const sorted = [...data].sort((a, b) => {
      if (!a.planned_date && !b.planned_date) return 0
      if (!a.planned_date) return 1
      if (!b.planned_date) return -1
      return a.planned_date.localeCompare(b.planned_date)
    })
    setRows(sorted)
  }

  const technicianName = (id: string | null | undefined) =>
    appUsers.find((u) => u.id === id)?.name ?? ''

  const statusVariant: Record<InstallationStatus, 'warning' | 'info' | 'success' | 'danger'> = {
    pending: 'warning',
    scheduled: 'info',
    completed: 'success',
    cancelled: 'danger',
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.customer}</th>
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.machine}</th>
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.serial}</th>
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.city}</th>
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.technician}</th>
            <th className="px-4 py-3 font-medium">{HE.reports.installationsPending.plannedDate}</th>
            <th className="px-4 py-3 font-medium">{HE.common.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="px-4 py-3">{row.customer_name}</td>
              <td className="px-4 py-3">{row.machine_name}</td>
              <td className="px-4 py-3">{row.serial_number}</td>
              <td className="px-4 py-3">{row.city}</td>
              <td className="px-4 py-3">{technicianName(row.technician_id)}</td>
              <td className="px-4 py-3">{formatDate(row.planned_date)}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant[row.status]}>{HE.installationStatus[row.status]}</Badge>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                {HE.common.noData}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

function LeadsArchivedMeetingReport() {
  const [rows, setRows] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const data = await fetchAllPages<Lead>((from, to) =>
      supabase
        .from('leads')
        .select('*')
        .eq('is_archived', true)
        .eq('status', 'meeting')
        .not('notes', 'is', null)
        .neq('notes', '')
        .range(from, to)
        .then((res) => ({ data: res.data as Lead[] | null })),
    )
    setRows(data)
  }

  return (
    <>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.reports.leadsArchivedMeeting.name}</th>
              <th className="px-4 py-3 font-medium">{HE.reports.leadsArchivedMeeting.phone}</th>
              <th className="px-4 py-3 font-medium">{HE.reports.leadsArchivedMeeting.city}</th>
              <th className="px-4 py-3 font-medium">{HE.common.status}</th>
              <th className="px-4 py-3 font-medium">{HE.reports.leadsArchivedMeeting.notes}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => (
              <tr key={lead.id} className="border-b border-gray-100">
                <td className="px-4 py-3">
                  <button
                    className="text-primary-600 hover:underline"
                    onClick={() => {
                      setSelectedLead(lead)
                      setModalOpen(true)
                    }}
                  >
                    {lead.name}
                  </button>
                </td>
                <td className="px-4 py-3">{lead.phone}</td>
                <td className="px-4 py-3">{lead.city}</td>
                <td className="px-4 py-3">
                  <Badge variant="info">{HE.leadStatus[lead.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">{lead.notes}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {HE.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lead={selectedLead}
        onSaved={load}
      />
    </>
  )
}
