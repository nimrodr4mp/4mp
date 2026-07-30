import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { useAppData } from '../../context/AppContext'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { HE } from '../../constants/hebrew'
import type { Meeting, MeetingStatus } from '../../types'

const STATUS_VARIANT: Record<MeetingStatus, 'info' | 'success' | 'danger' | 'warning'> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

interface MeetingHistoryProps {
  leadId?: string | null
  customerId?: string | null
  /** Also matches meetings recorded against this phone, so a lead and the
   *  customer it became share one history. */
  phone?: string | null
  /** Bump to force a reload — e.g. after scheduling a new meeting. */
  refreshKey?: number
}

export function MeetingHistory({ leadId, customerId, phone, refreshKey }: MeetingHistoryProps) {
  const { salesPersons } = useAppData()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selected, setSelected] = useState<Meeting | null>(null)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, customerId, phone, refreshKey])

  async function load() {
    const filters: string[] = []
    if (leadId) filters.push(`lead_id.eq.${leadId}`)
    if (customerId) filters.push(`customer_id.eq.${customerId}`)
    const cleanPhone = phone?.replace(/[,()]/g, '').trim()
    if (cleanPhone) filters.push(`phone.eq.${cleanPhone}`)
    if (filters.length === 0) {
      setMeetings([])
      return
    }
    const { data } = await supabase
      .from('meetings')
      .select('*')
      .or(filters.join(','))
      .order('scheduled_date', { ascending: false })
    setMeetings((data as Meeting[]) ?? [])
  }

  function salesPersonName(id?: string | null): string | null {
    return salesPersons.find((sp) => sp.id === id)?.name ?? null
  }

  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-gray-700">{HE.meetings.history}</label>
      <div className="flex max-h-44 flex-col gap-2 overflow-y-auto">
        {meetings.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m)}
            className="rounded-lg bg-gray-50 p-2 text-right text-xs hover:bg-gray-100"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-900">
                {m.title || m.customer_name || HE.meetings.title}
              </span>
              <Badge variant={STATUS_VARIANT[m.status]}>{HE.meetingStatus[m.status]}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-500">
              <span>{m.scheduled_date ? formatDate(m.scheduled_date) : '—'}</span>
              {m.scheduled_time && <span>{m.scheduled_time}</span>}
              <span>{HE.meetingType[m.meeting_type]}</span>
              {m.deal_value != null && (
                <span className="font-medium text-gray-700">
                  ₪{Number(m.deal_value).toLocaleString('he-IL')}
                </span>
              )}
            </div>
          </button>
        ))}
        {meetings.length === 0 && <p className="text-xs text-gray-400">{HE.meetings.noHistory}</p>}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={HE.meetings.meetingDetails}
        size="md"
      >
        {selected && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <p>
                <span className="text-gray-400">{HE.meetings.meetingTitle}: </span>
                {selected.title || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.status}: </span>
                {HE.meetingStatus[selected.status]}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.customerName}: </span>
                {selected.customer_name || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.common.phone}: </span>
                <span dir="ltr">{selected.phone || '—'}</span>
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.scheduledDate}: </span>
                {selected.scheduled_date ? formatDate(selected.scheduled_date) : '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.scheduledTime}: </span>
                {selected.scheduled_time || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.meetingType}: </span>
                {HE.meetingType[selected.meeting_type]}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.salesperson}: </span>
                {salesPersonName(selected.sales_person_id) || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.location}: </span>
                {selected.location || '—'}
              </p>
              <p>
                <span className="text-gray-400">{HE.meetings.dealValue}: </span>
                {selected.deal_value != null
                  ? `₪${Number(selected.deal_value).toLocaleString('he-IL')}`
                  : '—'}
              </p>
            </div>

            {selected.outcome && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500">{HE.meetings.outcome}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                  {selected.outcome}
                </p>
              </div>
            )}

            {selected.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500">{HE.common.notes}</p>
                <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                  {selected.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
