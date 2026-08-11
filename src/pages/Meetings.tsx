import { useEffect, useMemo, useState } from 'react'
import { Plus, MapPin, Clock, Trash2, X } from 'lucide-react'
import { fetchAllPages, supabase } from '../lib/supabase'
import { formatDate, generateId, localDate } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
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
  deal_value: '',
  outcome: '',
  notes: '',
  lead_id: '' as string,
  customer_id: '' as string,
}

interface LinkPick {
  kind: 'lead' | 'customer'
  id: string
  name: string
  phone: string | null
}

export default function Meetings() {
  const { role, user } = useAuth()
  const { salesPersons } = useAppData()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [linkQuery, setLinkQuery] = useState('')
  const [linkResults, setLinkResults] = useState<LinkPick[]>([])

  useEffect(() => {
    void loadMeetings()
  }, [role, user])

  useEffect(() => {
    if (!modalOpen) return
    const q = linkQuery.trim()
    if (q.length < 2) {
      setLinkResults([])
      return
    }
    const timer = setTimeout(() => void searchLinkTargets(q), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkQuery, modalOpen])

  async function searchLinkTargets(q: string) {
    const safe = q.replace(/[,()]/g, '')
    const [{ data: leadsData }, { data: customersData }] = await Promise.all([
      supabase
        .from('leads')
        .select('id,name,phone')
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(5),
      supabase
        .from('customers')
        .select('id,name,phone')
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(5),
    ])
    setLinkResults([
      ...(leadsData ?? []).map((l) => ({
        kind: 'lead' as const,
        id: l.id as string,
        name: l.name as string,
        phone: (l.phone as string) ?? null,
      })),
      ...(customersData ?? []).map((c) => ({
        kind: 'customer' as const,
        id: c.id as string,
        name: c.name as string,
        phone: (c.phone as string) ?? null,
      })),
    ])
  }

  function pickLinkTarget(pick: LinkPick) {
    setForm((f) => ({
      ...f,
      lead_id: pick.kind === 'lead' ? pick.id : '',
      customer_id: pick.kind === 'customer' ? pick.id : '',
      customer_name: pick.name,
      phone: pick.phone ?? f.phone,
    }))
    setLinkQuery('')
    setLinkResults([])
  }

  function clearLinkTarget() {
    setForm((f) => ({ ...f, lead_id: '', customer_id: '' }))
  }

  async function loadMeetings() {
    const data = await fetchAllPages<Meeting>((from, to) => {
      let query = supabase.from('meetings').select('*')
      if (role === 'sales' && user?.sales_person_id) {
        query = query.eq('sales_person_id', user.sales_person_id)
      }
      return query.order('scheduled_date', { ascending: true }).range(from, to)
    })
    setMeetings(data)
  }

  function openNew() {
    setEditing(null)
    setForm({ ...emptyForm, sales_person_id: user?.sales_person_id ?? '' })
    setLinkQuery('')
    setLinkResults([])
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
      deal_value: meeting.deal_value != null ? String(meeting.deal_value) : '',
      outcome: meeting.outcome ?? '',
      notes: meeting.notes ?? '',
      lead_id: meeting.lead_id ?? '',
      customer_id: meeting.customer_id ?? '',
    })
    setLinkQuery('')
    setLinkResults([])
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
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        outcome: form.outcome || null,
        notes: form.notes || null,
        lead_id: form.lead_id || null,
        customer_id: form.customer_id || null,
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

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('meetings').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    setModalOpen(false)
    void loadMeetings()
  }

  // Upcoming = today onwards. Undated meetings are never "past", so they stay
  // visible in the default view rather than disappearing.
  const visibleMeetings = useMemo(() => {
    const today = localDate()
    const isPast = (m: Meeting) => !!m.scheduled_date && m.scheduled_date < today
    const list = meetings.filter((m) => (showPast ? isPast(m) : !isPast(m)))
    // Past meetings read best newest-first; upcoming ones soonest-first.
    return showPast
      ? [...list].sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''))
      : list
  }, [meetings, showPast])

  const grouped = visibleMeetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const key = m.scheduled_date ?? HE.common.noData
    acc[key] = acc[key] ?? []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {showPast ? HE.meetings.pastTitle : HE.meetings.upcomingTitle}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPast((v) => !v)}>
            {showPast ? HE.meetings.showUpcoming : HE.meetings.showPast}
          </Button>
          <Button onClick={openNew}>
            <Plus size={16} /> {HE.meetings.addMeeting}
          </Button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <p className="text-sm text-gray-400">
          {showPast ? HE.meetings.noMeetings : HE.meetings.noUpcoming}
        </p>
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
                  {m.deal_value != null && (
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      ₪{Number(m.deal_value).toLocaleString('he-IL')}
                    </p>
                  )}
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {HE.meetings.linkTo}
            </label>
            {form.lead_id || form.customer_id ? (
              <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm">
                <span className="text-primary-900">
                  <span className="text-primary-500">
                    {form.lead_id ? HE.meetings.lead : HE.meetings.customer}:{' '}
                  </span>
                  {form.customer_name}
                </span>
                <button
                  type="button"
                  onClick={clearLinkTarget}
                  className="rounded-full p-1 text-primary-500 hover:bg-primary-100"
                  aria-label={HE.meetings.unlink}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <Input
                  placeholder={HE.meetings.searchLinkTo}
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                />
                {linkQuery.trim().length >= 2 && (
                  <div className="mt-1 flex max-h-36 flex-col gap-0.5 overflow-y-auto rounded-lg border border-gray-100 p-1">
                    {linkResults.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-gray-400">{HE.meetings.noResults}</p>
                    )}
                    {linkResults.map((r) => (
                      <button
                        key={`${r.kind}-${r.id}`}
                        type="button"
                        onClick={() => pickLinkTarget(r)}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-right text-sm hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{r.name}</span>
                          {r.phone && (
                            <span className="text-xs text-gray-400" dir="ltr">
                              {r.phone}
                            </span>
                          )}
                        </span>
                        <Badge variant="outline">
                          {r.kind === 'lead' ? HE.meetings.lead : HE.meetings.customer}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

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
          <div className="grid grid-cols-2 gap-4">
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
              label={HE.meetings.dealValue}
              type="number"
              min="0"
              value={form.deal_value}
              onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))}
            />
          </div>
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
          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            {editing ? (
              <Button
                variant="danger"
                onClick={() => setDeleteTarget(editing)}
                aria-label={HE.meetings.deleteMeeting}
              >
                <Trash2 size={16} /> {HE.common.delete}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                {HE.common.cancel}
              </Button>
              <Button onClick={handleSave} loading={isSaving}>
                {HE.common.save}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={HE.meetings.deleteMeeting}
        message={HE.meetings.deleteMeetingConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  )
}
