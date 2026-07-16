import { useEffect, useState } from 'react'
import { Plus, MapPin, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, generateId } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { Meeting, MeetingStatus, MeetingType } from '../types'

const STATUS_VARIANT: Record<MeetingStatus, 'info' | 'success' | 'danger' | 'warning'> = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

const emptyForm = {
  title: '',
  customer_name: '',
  phone: '',
  sales_person_id: '',
  meeting_type: 'in_person' as MeetingType,
  scheduled_date: '',
  scheduled_time: '',
  location: '',
  status: 'scheduled' as MeetingStatus,
  outcome: '',
  notes: '',
}

export default function Meetings() {
  const { role, user } = useAuth()
  const { salesPersons } = useAppData()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void loadMeetings()
  }, [role, user])

  async function loadMeetings() {
    let query = supabase.from('meetings').select('*')
    if (role === 'sales' && user?.sales_person_id) {
      query = query.eq('sales_person_id', user.sales_person_id)
    }
    const { data } = await query.order('scheduled_date', { ascending: true })
    setMeetings((data as Meeting[]) ?? [])
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm, sales_person_id: user?.sales_person_id ?? '' })
    setModalOpen(true)
  }

  function openEdit(meeting: Meeting) {
    setEditing(meeting)
    setForm({
      title: meeting.title ?? '',
      customer_name: meeting.customer_name ?? '',
      phone: meeting.phone ?? '',
      sales_person_id: meeting.sales_person_id ?? '',
      meeting_type: meeting.meeting_type,
      scheduled_date: meeting.scheduled_date ?? '',
      scheduled_time: meeting.scheduled_time ?? '',
      location: meeting.location ?? '',
      status: meeting.status,
      outcome: meeting.outcome ?? '',
      notes: meeting.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const payload = {
        title: form.title || null,
        customer_name: form.customer_name || null,
        phone: form.phone || null,
        sales_person_id: form.sales_person_id || null,
        meeting_type: form.meeting_type,
        scheduled_date: form.scheduled_date || null,
        scheduled_time: form.scheduled_time || null,
        location: form.location || null,
        status: form.status,
        outcome: form.outcome || null,
        notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        await supabase.from('meetings').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('meetings').insert({ id: generateId(), ...payload })
      }
      setModalOpen(false)
      void loadMeetings()
    } finally {
      setIsSaving(false)
    }
  }

  const grouped = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const key = m.scheduled_date ?? HE.common.noData
    acc[key] = acc[key] ?? []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.meetings.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.meetings.addMeeting}
        </Button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-gray-400">{HE.meetings.noMeetings}</p>
      )}

      <div className="flex flex-col gap-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="mb-2 text-sm font-semibold text-gray-500">{formatDate(date)}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((m) => (
                <Card
                  key={m.id}
                  className="cursor-pointer p-4"
                  onClick={() => openEdit(m)}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {m.customer_name || m.title || HE.meetings.title}
                    </span>
                    <Badge variant={STATUS_VARIANT[m.status]}>{HE.meetingStatus[m.status]}</Badge>
                  </div>
                  {m.customer_name && m.title && (
                    <p className="mb-1 text-xs text-gray-500">{m.title}</p>
                  )}
                  {m.phone && <p className="mb-1 text-xs text-gray-500" dir="ltr">{m.phone}</p>}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} /> {m.scheduled_time ?? '—'}
                    <Badge variant="outline" className="mr-2">
                      {HE.meetingType[m.meeting_type]}
                    </Badge>
                  </div>
                  {m.location && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} /> {m.location}
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
        title={editing ? HE.meetings.editMeeting : HE.meetings.addMeeting}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.meetings.meetingTitle}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={HE.meetings.customerName}
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            />
            <Input
              label={HE.common.phone}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={HE.meetings.salesperson}
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
            <Select
              label={HE.meetings.meetingType}
              value={form.meeting_type}
              onChange={(e) => setForm((f) => ({ ...f, meeting_type: e.target.value as MeetingType }))}
            >
              {Object.entries(HE.meetingType).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={HE.meetings.scheduledDate}
              type="date"
              value={form.scheduled_date}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
            />
            <Input
              label={HE.meetings.scheduledTime}
              type="time"
              value={form.scheduled_time}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value }))}
            />
          </div>
          <Input
            label={HE.meetings.location}
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <Select
            label={HE.common.status}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MeetingStatus }))}
          >
            {Object.entries(HE.meetingStatus).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label={HE.meetings.outcome}
            value={form.outcome}
            onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
          />
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
