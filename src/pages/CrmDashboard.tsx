import { useEffect, useState } from 'react'
import { Star, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { LeadModal } from '../components/leads/LeadModal'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { HE } from '../constants/hebrew'
import type { Lead, LeadStatus } from '../types'

const PIPELINE_STATUSES: LeadStatus[] = ['new', 'meeting', 'in_progress', 'interested', 'proposal']

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
    let query = supabase
      .from('leads')
      .select('*')
      .eq('is_archived', false)
      .in('status', PIPELINE_STATUSES)

    if (role === 'sales' && user?.sales_person_id) {
      query = query.eq('assigned_to', user.sales_person_id)
    } else if (role === 'admin' && salespersonFilter) {
      query = query.eq('assigned_to', salespersonFilter)
    }

    const { data } = await query.order('updated_at', { ascending: false })
    setLeads((data as Lead[]) ?? [])
  }

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PIPELINE_STATUSES.map((status) => {
          const columnLeads = leads.filter((l) => l.status === status)
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
