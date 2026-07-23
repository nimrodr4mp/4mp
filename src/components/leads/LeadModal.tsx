import { useEffect, useState } from 'react'
import { Star, Trash2, Plus, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateId, formatDate, localDate } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppContext'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { HE } from '../../constants/hebrew'
import type {
  BusinessType,
  ClientStatus,
  Lead,
  LeadInteraction,
  LeadSource,
  LeadStatus,
  Reminder,
} from '../../types'

interface LeadModalProps {
  open: boolean
  onClose: () => void
  lead: Lead | null
  onSaved: () => void
  initialPhone?: string
}

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  city: '',
  source: 'direct' as LeadSource,
  status: 'new' as LeadStatus,
  score: 0,
  assigned_to: '',
  machines_interested: [] as string[],
  business_type: '' as BusinessType | '',
  client_status: '' as ClientStatus | '',
  deal_value: '',
  follow_up_date: '',
  conversation_summary: '',
}

export function LeadModal({ open, onClose, lead, onSaved, initialPhone }: LeadModalProps) {
  const { user } = useAuth()
  const { machines, salesPersons } = useAppData()
  const [form, setForm] = useState(emptyForm)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [interactions, setInteractions] = useState<LeadInteraction[]>([])
  const [newInteractionType, setNewInteractionType] = useState<LeadInteraction['type']>('note')
  const [newInteractionContent, setNewInteractionContent] = useState('')
  const [duplicateFound, setDuplicateFound] = useState(false)
  const [isReturn, setIsReturn] = useState(false)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingDate, setMeetingDate] = useState(localDate())
  const [meetingTime, setMeetingTime] = useState('')
  const [meetingLocation, setMeetingLocation] = useState('')

  useEffect(() => {
    if (!open) return
    if (lead) {
      setForm({
        name: lead.name,
        phone: lead.phone,
        email: lead.email ?? '',
        city: lead.city ?? '',
        source: lead.source,
        status: lead.status,
        score: lead.score,
        assigned_to: lead.assigned_to ?? '',
        machines_interested: lead.machines_interested ?? [],
        business_type: lead.business_type ?? '',
        client_status: lead.client_status ?? '',
        deal_value: lead.deal_value != null ? String(lead.deal_value) : '',
        follow_up_date: lead.follow_up_date ?? '',
        conversation_summary: lead.conversation_summary ?? '',
      })
      setReminders(lead.reminders ?? [])
      setIsReturn(lead.is_return ?? false)
      void loadInteractions(lead.id)
    } else {
      setForm({ ...emptyForm, phone: initialPhone ?? '' })
      setReminders([])
      setInteractions([])
      setIsReturn(false)
    }
    setDuplicateFound(false)
    setShowMeetingForm(false)
    // Clear per-lead draft state so it doesn't leak into the next lead opened.
    setNewInteractionContent('')
    setNewInteractionType('note')
    setMeetingDate(localDate())
    setMeetingTime('')
    setMeetingLocation('')
  }, [open, lead, initialPhone])

  async function loadInteractions(leadId: string) {
    const { data } = await supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    setInteractions((data as LeadInteraction[]) ?? [])
  }

  async function checkDuplicatePhone(phone: string) {
    if (lead || !phone) return
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', phone)
      .limit(1)
      .maybeSingle()
    setDuplicateFound(!!data)
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleMachine(id: string) {
    setForm((f) => ({
      ...f,
      machines_interested: f.machines_interested.includes(id)
        ? f.machines_interested.filter((m) => m !== id)
        : [...f.machines_interested, id],
    }))
  }

  function addReminder() {
    setReminders((r) => [...r, { id: generateId(), date: localDate(), time: '', text: '' }])
  }

  function updateReminder(id: string, patch: Partial<Reminder>) {
    setReminders((r) => r.map((rem) => (rem.id === id ? { ...rem, ...patch } : rem)))
  }

  function removeReminder(id: string) {
    setReminders((r) => r.filter((rem) => rem.id !== id))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        city: form.city || null,
        source: form.source,
        status: form.status,
        score: form.score,
        assigned_to: form.assigned_to || null,
        machines_interested: form.machines_interested,
        business_type: form.business_type || null,
        client_status: form.client_status || null,
        deal_value: form.deal_value ? Number(form.deal_value) : null,
        follow_up_date: form.follow_up_date || null,
        conversation_summary: form.conversation_summary || null,
        reminders,
        is_return: isReturn,
        updated_at: now,
      }

      if (lead) {
        if (lead.status !== form.status) {
          await supabase.from('lead_interactions').insert({
            id: generateId(),
            lead_id: lead.id,
            type: 'log',
            content: `סטטוס שונה מ-${HE.leadStatus[lead.status]} ל-${HE.leadStatus[form.status]}`,
            created_by: user?.name ?? user?.id ?? '',
          })
        }
        await supabase.from('leads').update(payload).eq('id', lead.id)
      } else {
        await supabase.from('leads').insert({
          id: generateId(),
          ...payload,
          created_at: now,
          is_archived: false,
        })
      }
      onSaved()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddInteraction() {
    if (!lead || !newInteractionContent.trim()) return
    await supabase.from('lead_interactions').insert({
      id: generateId(),
      lead_id: lead.id,
      type: newInteractionType,
      content: newInteractionContent.trim(),
      created_by: user?.name ?? user?.id ?? '',
    })
    setNewInteractionContent('')
    void loadInteractions(lead.id)
  }

  async function handleCreateMeeting() {
    if (!lead) return
    const meetingId = generateId()
    await supabase.from('meetings').insert({
      id: meetingId,
      lead_id: lead.id,
      sales_person_id: form.assigned_to || null,
      customer_name: form.name,
      phone: form.phone,
      meeting_type: 'in_person',
      scheduled_date: meetingDate || null,
      scheduled_time: meetingTime || null,
      location: meetingLocation || null,
      status: 'scheduled',
    })
    await supabase.from('lead_interactions').insert({
      id: generateId(),
      lead_id: lead.id,
      type: 'log',
      content: `נקבעה פגישה לתאריך ${formatDate(meetingDate)}`,
      created_by: user?.name ?? user?.id ?? '',
      meeting_id: meetingId,
    })
    setShowMeetingForm(false)
    void loadInteractions(lead.id)
  }

  return (
    <Modal open={open} onClose={onClose} title={lead ? HE.leads.editLead : HE.leads.addLead} size="2xl">
      <div className="flex flex-col gap-4">
        {duplicateFound && !lead && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="mb-2">{HE.leads.duplicatePhoneText}</p>
            <div className="flex gap-2">
              <Button size="xs" onClick={() => { setIsReturn(true); setDuplicateFound(false) }}>
                {HE.leads.markAsReturning}
              </Button>
              <Button size="xs" variant="outline" onClick={() => setDuplicateFound(false)}>
                {HE.leads.createAnyway}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-2">
          {/* ── LEFT: lead details ── */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={HE.common.name}
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
              <Input
                label={HE.common.phone}
                required
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                onBlur={(e) => void checkDuplicatePhone(e.target.value)}
              />
              <Input
                label={HE.common.email}
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
              <Input
                label={HE.common.city}
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
              />
              <Select
                label={HE.leads.source}
                value={form.source}
                onChange={(e) => update('source', e.target.value as LeadSource)}
              >
                {Object.entries(HE.leadSource).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                label={HE.common.status}
                value={form.status}
                onChange={(e) => update('status', e.target.value as LeadStatus)}
              >
                {Object.entries(HE.leadStatus).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                label={HE.leads.assignedTo}
                value={form.assigned_to}
                onChange={(e) => update('assigned_to', e.target.value)}
              >
                <option value="">{HE.common.all}</option>
                {salesPersons.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </Select>
              <Select
                label={HE.leads.businessType}
                value={form.business_type}
                onChange={(e) => update('business_type', e.target.value as BusinessType)}
              >
                <option value="">-</option>
                {Object.entries(HE.businessType).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                label={HE.leads.clientStatus}
                value={form.client_status}
                onChange={(e) => update('client_status', e.target.value as ClientStatus)}
              >
                <option value="">-</option>
                <option value="existing">{HE.leads.clientExisting}</option>
                <option value="new">{HE.leads.clientNew}</option>
              </Select>
              <Input
                label={HE.leads.followUpDate}
                type="date"
                value={form.follow_up_date}
                onChange={(e) => update('follow_up_date', e.target.value)}
              />
              <Input
                label={HE.leads.dealValue}
                type="number"
                min="0"
                value={form.deal_value}
                onChange={(e) => update('deal_value', e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  {HE.leads.score}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => update('score', n)}>
                      <Star
                        size={20}
                        className={n <= form.score ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReturn((v) => !v)}
                className={
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ' +
                  (isReturn
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600')
                }
              >
                <RotateCcw size={14} />
                {HE.leads.isReturn}
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {HE.leads.machinesInterested}
              </label>
              <div className="flex flex-wrap gap-2">
                {machines.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMachine(m.id)}
                    className={
                      'rounded-full border px-3 py-1 text-xs font-medium ' +
                      (form.machines_interested.includes(m.id)
                        ? 'border-primary-600 bg-primary-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700')
                    }
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                {HE.leads.conversationSummary}
              </label>
              <textarea
                value={form.conversation_summary}
                onChange={(e) => update('conversation_summary', e.target.value)}
                rows={2}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
            </div>

            {lead?.origin_url && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <p className="mb-1 text-xs font-semibold text-gray-500">{HE.leads.originUrl}</p>
                <a
                  href={lead.origin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs text-primary-600 hover:underline"
                  dir="ltr"
                >
                  {lead.origin_url}
                </a>
              </div>
            )}

            {lead?.notes && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <p className="mb-1 text-xs font-semibold text-gray-500">{HE.leads.oldSystemNotes}</p>
                <p className="whitespace-pre-wrap text-xs text-gray-600">{lead.notes}</p>
              </div>
            )}
          </div>

          {/* ── RIGHT: activity ── */}
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">{HE.leads.reminders}</label>
                <Button size="xs" variant="outline" onClick={addReminder}>
                  <Plus size={14} /> {HE.leads.addReminder}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {reminders.map((rem) => (
                  <div key={rem.id} className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={rem.date}
                      onChange={(e) => updateReminder(rem.id, { date: e.target.value })}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="time"
                      value={rem.time ?? ''}
                      onChange={(e) => updateReminder(rem.id, { time: e.target.value })}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder={HE.leads.reminderText}
                      value={rem.text}
                      onChange={(e) => updateReminder(rem.id, { text: e.target.value })}
                      className="min-w-[8rem] flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button onClick={() => removeReminder(rem.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {reminders.length === 0 && (
                  <p className="text-xs text-gray-300">{HE.common.noData}</p>
                )}
              </div>
            </div>

            {lead && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">{HE.leads.interactions}</label>
                  <Button size="xs" variant="outline" onClick={() => setShowMeetingForm((v) => !v)}>
                    {HE.leads.scheduleMeeting}
                  </Button>
                </div>

                {showMeetingForm && (
                  <div className="mb-3 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3">
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="time"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder={HE.meetings.location}
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                    />
                    <Button size="xs" onClick={handleCreateMeeting}>
                      {HE.common.save}
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Select
                    value={newInteractionType}
                    onChange={(e) => setNewInteractionType(e.target.value as LeadInteraction['type'])}
                    className="w-28"
                  >
                    {Object.entries(HE.leads.interactionType).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="text"
                    value={newInteractionContent}
                    onChange={(e) => setNewInteractionContent(e.target.value)}
                    placeholder={HE.leads.interactionContent}
                    className="min-w-[8rem] flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <Button size="sm" onClick={handleAddInteraction}>
                    {HE.common.add}
                  </Button>
                </div>

                <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
                  {interactions.map((it) => (
                    <div key={it.id} className="rounded-lg bg-gray-50 p-2 text-xs">
                      <div className="flex justify-between text-gray-400">
                        <span>{HE.leads.interactionType[it.type]} · {it.created_by}</span>
                        <span>{formatDate(it.created_at)}</span>
                      </div>
                      <p className="mt-1 text-gray-700">{it.content}</p>
                    </div>
                  ))}
                  {interactions.length === 0 && (
                    <p className="text-xs text-gray-400">{HE.common.noData}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            {HE.common.cancel}
          </Button>
          <Button onClick={handleSave} loading={isSaving}>
            {HE.common.save}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
