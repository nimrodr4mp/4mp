import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { LeadModal } from '../components/leads/LeadModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Badge } from '../components/ui/Badge'
import { HE } from '../constants/hebrew'
import type { Lead, LeadStatus } from '../types'

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<LeadStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  new: 'info',
  contacted: 'info',
  meeting: 'info',
  in_progress: 'warning',
  interested: 'success',
  proposal: 'info',
  won: 'success',
  lost: 'danger',
  not_relevant: 'default',
  double: 'default',
  service_existing: 'success',
  clinical_inquiry: 'warning',
}

export default function Leads() {
  const { role, user } = useAuth()
  const { salesPersons } = useAppData()
  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [showArchived, setShowArchived] = useState(role === 'admin')
  const [page, setPage] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    void loadLeads()
  }, [role, user, search, statusFilter, sourceFilter, assignedFilter, showArchived, page])

  async function loadLeads() {
    let query = supabase.from('leads').select('*', { count: 'exact' })

    if (role === 'sales' && user?.sales_person_id) {
      query = query.eq('assigned_to', user.sales_person_id)
    }
    if (!showArchived) {
      query = query.eq('is_archived', false)
    }
    if (statusFilter) query = query.eq('status', statusFilter)
    if (sourceFilter) query = query.eq('source', sourceFilter)
    if (assignedFilter) query = query.eq('assigned_to', assignedFilter)
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data, count } = await query.order('created_at', { ascending: false }).range(from, to)

    setLeads((data as Lead[]) ?? [])
    setTotalCount(count ?? 0)
  }

  function openLead(lead: Lead | null) {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const salesPersonName = (id: string | null | undefined) =>
    salesPersons.find((sp) => sp.id === id)?.name ?? ''

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{HE.leads.title}</h1>
        <Button onClick={() => openLead(null)}>
          <Plus size={16} /> {HE.leads.addLead}
        </Button>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setPage(0)
              setSearch(e.target.value)
            }}
            placeholder={HE.leads.searchPlaceholder}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(0)
            setStatusFilter(e.target.value)
          }}
          className="w-40"
        >
          <option value="">{HE.leads.filterStatus}</option>
          {Object.entries(HE.leadStatus).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={sourceFilter}
          onChange={(e) => {
            setPage(0)
            setSourceFilter(e.target.value)
          }}
          className="w-40"
        >
          <option value="">{HE.leads.filterSource}</option>
          {Object.entries(HE.leadSource).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        {role === 'admin' && (
          <Select
            value={assignedFilter}
            onChange={(e) => {
              setPage(0)
              setAssignedFilter(e.target.value)
            }}
            className="w-40"
          >
            <option value="">{HE.leads.filterAssigned}</option>
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
            checked={showArchived}
            onChange={(e) => {
              setPage(0)
              setShowArchived(e.target.checked)
            }}
          />
          {HE.leads.showArchived}
        </label>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.common.name}</th>
              <th className="px-4 py-3 font-medium">{HE.common.phone}</th>
              <th className="px-4 py-3 font-medium">{HE.common.city}</th>
              <th className="px-4 py-3 font-medium">{HE.leads.title}</th>
              <th className="px-4 py-3 font-medium">{HE.common.status}</th>
              <th className="px-4 py-3 font-medium">{HE.leads.score}</th>
              <th className="px-4 py-3 font-medium">{HE.leads.assignedTo}</th>
              <th className="px-4 py-3 font-medium">{HE.common.date}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => openLead(lead)}
                className={
                  'cursor-pointer border-b border-gray-100 ' +
                  (lead.status === 'meeting'
                    ? 'bg-amber-50 hover:bg-amber-100'
                    : 'hover:bg-gray-50')
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {lead.name}
                    {lead.is_return && <Badge variant="info">{HE.leads.isReturn}</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">{lead.phone}</td>
                <td className="px-4 py-3">{lead.city}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{HE.leadSource[lead.source]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[lead.status]}>{HE.leadStatus[lead.status]}</Badge>
                </td>
                <td className="px-4 py-3">{lead.score}</td>
                <td className="px-4 py-3">{salesPersonName(lead.assigned_to)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDate(lead.created_at)}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {HE.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-600">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {HE.common.previous}
          </Button>
          <span>
            {HE.common.page} {page + 1} {HE.common.of} {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            {HE.common.next}
          </Button>
        </div>
      )}

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lead={selectedLead}
        onSaved={loadLeads}
      />
    </div>
  )
}
