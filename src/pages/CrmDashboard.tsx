import { useEffect, useMemo, useState } from 'react'
import { Star, Plus, Bell } from 'lucide-react'
import { addDays } from 'date-fns'
import { fetchAllPages, supabase } from '../lib/supabase'
import { formatDate, localDate } from '../lib/utils'
import { ownSalesPersonId } from '../lib/permissions'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { LeadModal } from '../components/leads/LeadModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { HE } from '../constants/hebrew'
import type { Lead, LeadStatus, Reminder } from '../types'

const PIPELINE_STATUSES: LeadStatus[] = ['new', 'meeting', 'in_progress', 'interested', 'proposal']

/** How far ahead the dashboard looks. Anything overdue is always shown. */
const REMINDER_HORIZON_DAYS = 7

export default function CrmDashboard() {
  const { role, user } = useAuth()
  const { salesPersons } = useAppData()
  const [leads, setLeads] = useState<Lead[]>([])
  const [salespersonFilter, setSalespersonFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    void loadLeads()
  }, [role, user, salespersonFilter])

  async function loadLeads() {
    // Every active lead, not just the pipeline ones: a reminder can sit on a
    // lead in any status, and the board filters down from this below.
    // Paged, since this can exceed one response.
    const data = await fetchAllPages<Lead>((from, to) => {
      let query = supabase.from('leads').select('*').eq('is_archived', false)

      const mine = role && ownSalesPersonId(role, user?.sales_person_id)
      if (mine) {
        query = query.eq('assigned_to', mine)
      } else if (role === 'admin' && salespersonFilter) {
        query = query.eq('assigned_to', salespersonFilter)
      }

      return query.order('updated_at', { ascending: false }).range(from, to)
    })
    setLeads(data)
  }

  const pipelineLeads = useMemo(
    () => leads.filter((l) => PIPELINE_STATUSES.includes(l.status)),
    [leads],
  )

  /** Reminders that need attention: anything overdue, plus the next week. */
  const dueReminders = useMemo(() => {
    const horizon = localDate(addDays(new Date(), REMINDER_HORIZON_DAYS))
    const rows: { lead: Lead; reminder: Reminder }[] = []
    for (const lead of leads) {
      for (const reminder of lead.reminders ?? []) {
        if (reminder.date && reminder.date <= horizon) rows.push({ lead, reminder })
      }
    }
    const sortKey = (r: Reminder) => `${r.date} ${r.time ?? ''}`
    return rows.sort((a, b) => sortKey(a.reminder).localeCompare(sortKey(b.reminder)))
  }, [leads])

  const overdueCount = useMemo(() => {
    const today = localDate()
    return dueReminders.filter((r) => r.reminder.date < today).length
  }, [dueReminders])

  function openLead(lead: Lead | null) {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.crm.pipelineTitle}</h1>
        <div className="flex items-center gap-3">
          {role === 'admin' && (
            <Select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="w-48"
            >
              <option value="">{HE.crm.filterBySalesperson}</option>
              {salesPersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </Select>
          )}
          <Button onClick={() => openLead(null)}>
            <Plus size={16} /> {HE.crm.addLead}
          </Button>
        </div>
      </div>

      <Card className="mb-6 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">{HE.crm.remindersTitle}</h2>
          {dueReminders.length > 0 && (
            <Badge variant={overdueCount > 0 ? 'danger' : 'info'}>{dueReminders.length}</Badge>
          )}
        </div>

        {dueReminders.length === 0 ? (
          <p className="text-xs text-gray-400">{HE.crm.noReminders}</p>
        ) : (
          <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
            {dueReminders.map(({ lead, reminder }) => {
              const today = localDate()
              const isOverdue = reminder.date < today
              const isToday = reminder.date === today
              const tone = isOverdue
                ? 'border-red-200 bg-red-50 hover:bg-red-100'
                : isToday
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              return (
                <button
                  key={`${lead.id}-${reminder.id}`}
                  type="button"
                  onClick={() => openLead(lead)}
                  className={
                    'flex items-start justify-between gap-3 rounded-lg border p-2 text-right text-xs ' +
                    tone
                  }
                >
                  <span className="flex-1">
                    <span className="font-medium text-gray-900">{lead.name}</span>
                    {lead.phone && (
                      <span className="text-gray-400" dir="ltr">
                        {' '}
                        {lead.phone}
                      </span>
                    )}
                    {reminder.text && <span className="text-gray-600"> — {reminder.text}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {isOverdue && <Badge variant="danger">{HE.crm.overdue}</Badge>}
                    {isToday && <Badge variant="warning">{HE.crm.today}</Badge>}
                    <span className="whitespace-nowrap text-gray-500">
                      {formatDate(reminder.date)}
                      {reminder.time ? ` ${reminder.time}` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE_STATUSES.map((status) => {
          const columnLeads = pipelineLeads.filter((l) => l.status === status)
          return (
            <div key={status} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-gray-700">{HE.leadStatus[status]}</span>
                <span className="text-xs text-gray-400">{columnLeads.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {columnLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    className="cursor-pointer p-3 hover:border-primary-300"
                    onClick={() => openLead(lead)}
                  >
                    <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.phone}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={12}
                            className={
                              n <= lead.score ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                            }
                          />
                        ))}
                      </div>
                      {lead.deal_value != null && (
                        <span className="text-[10px] font-medium text-gray-600">
                          ₪{lead.deal_value.toLocaleString('he-IL')}
                        </span>
                      )}
                    </div>
                    {lead.business_type && (
                      <p className="mt-1 text-[10px] text-gray-400">
                        {HE.businessType[lead.business_type]}
                      </p>
                    )}
                  </Card>
                ))}
                {columnLeads.length === 0 && (
                  <p className="px-1 text-xs text-gray-300">{HE.common.noData}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lead={selectedLead}
        onSaved={loadLeads}
      />
    </div>
  )
}
