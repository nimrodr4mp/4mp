import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateId } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Modal } from '../ui/Modal'
import { HE } from '../../constants/hebrew'
import type { TrainingSession } from '../../types'

interface AttendeePick {
  kind: 'lead' | 'customer'
  id: string
  name: string
  phone: string | null
  extra: string | null
}

const emptyForm = {
  name: '',
  description: '',
  subject: '',
  start_date: '',
  end_date: '',
}

interface TrainingSessionModalProps {
  open: boolean
  onClose: () => void
  editing: TrainingSession | null
  onSaved: () => void
}

export function TrainingSessionModal({ open, onClose, editing, onSaved }: TrainingSessionModalProps) {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [selected, setSelected] = useState<AttendeePick[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AttendeePick[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setSaveError(null)
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        subject: editing.subject ?? '',
        start_date: editing.start_date,
        end_date: editing.end_date,
      })
      void loadAttendees(editing.id)
    } else {
      setForm(emptyForm)
      setSelected([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => void runSearch(q), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  async function loadAttendees(sessionId: string) {
    const { data } = await supabase.from('training_attendees').select('*').eq('session_id', sessionId)
    setSelected(
      (data ?? []).map((a) => ({
        kind: a.lead_id ? ('lead' as const) : ('customer' as const),
        id: (a.lead_id ?? a.customer_id) as string,
        name: a.attendee_name,
        phone: a.attendee_phone,
        extra: null,
      })),
    )
  }

  async function runSearch(q: string) {
    const safe = q.replace(/[,()]/g, '')
    const [{ data: leadsData }, { data: customersData }] = await Promise.all([
      supabase
        .from('leads')
        .select('id,name,phone,city')
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(8),
      supabase
        .from('customers')
        .select('id,name,phone,city')
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
        .limit(8),
    ])
    setResults([
      ...(leadsData ?? []).map((l) => ({
        kind: 'lead' as const,
        id: l.id as string,
        name: l.name as string,
        phone: (l.phone as string) ?? null,
        extra: (l.city as string) ?? null,
      })),
      ...(customersData ?? []).map((c) => ({
        kind: 'customer' as const,
        id: c.id as string,
        name: c.name as string,
        phone: (c.phone as string) ?? null,
        extra: (c.city as string) ?? null,
      })),
    ])
  }

  function addAttendee(pick: AttendeePick) {
    setSelected((prev) =>
      prev.some((s) => s.kind === pick.kind && s.id === pick.id) ? prev : [...prev, pick],
    )
  }

  function removeAttendee(pick: AttendeePick) {
    setSelected((prev) => prev.filter((s) => !(s.kind === pick.kind && s.id === pick.id)))
  }

  /** Why saving is blocked, or null when the form is good to go. */
  const validationError = !form.name.trim()
    ? HE.training.nameRequired
    : !form.start_date
      ? HE.training.startDateRequired
      : form.end_date && form.end_date < form.start_date
        ? HE.training.endBeforeStart
        : null

  async function handleSave() {
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      // A single-day training only needs a start date.
      const endDate = form.end_date || form.start_date
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        subject: form.subject || null,
        start_date: form.start_date,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      }

      let sessionId = editing?.id ?? ''
      if (editing) {
        const { error } = await supabase
          .from('training_sessions')
          .update(payload)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        sessionId = generateId()
        const { error } = await supabase
          .from('training_sessions')
          .insert({ id: sessionId, created_by: user?.id ?? null, ...payload })
        if (error) throw error
      }

      const { error: delError } = await supabase
        .from('training_attendees')
        .delete()
        .eq('session_id', sessionId)
      if (delError) throw delError

      if (selected.length > 0) {
        const { error: insError } = await supabase.from('training_attendees').insert(
          selected.map((s) => ({
            id: generateId(),
            session_id: sessionId,
            lead_id: s.kind === 'lead' ? s.id : null,
            customer_id: s.kind === 'customer' ? s.id : null,
            attendee_name: s.name,
            attendee_phone: s.phone,
          })),
        )
        if (insError) throw insError
      }

      onSaved()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSaveError(`${HE.training.saveFailed} ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? HE.training.editSession : HE.training.addSession}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <Input
          label={HE.training.name}
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label={HE.training.subject}
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">{HE.training.description}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={HE.training.startDate}
            type="date"
            required
            value={form.start_date}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                start_date: e.target.value,
                // Keep a single-day training valid without touching the end date.
                end_date: !f.end_date || f.end_date < e.target.value ? e.target.value : f.end_date,
              }))
            }
          />
          <Input
            label={HE.training.endDate}
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {HE.training.attendees}
          </label>

          {selected.length === 0 ? (
            <p className="mb-2 text-xs text-gray-400">{HE.training.noAttendees}</p>
          ) : (
            <div className="mb-3 flex flex-wrap gap-2">
              {selected.map((s) => (
                <Badge key={`${s.kind}-${s.id}`} variant="info" className="gap-1 pl-1">
                  {s.name}
                  {s.phone && <span dir="ltr">({s.phone})</span>}
                  <span className="text-[10px] opacity-70">
                    {s.kind === 'lead' ? HE.training.lead : HE.training.customer}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttendee(s)}
                    className="rounded-full p-0.5 hover:bg-black/10"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <Input
            placeholder={HE.training.searchAttendee}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {query.trim().length >= 2 && (
            <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-gray-100 p-1">
              {results.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-gray-400">{HE.training.noResults}</p>
              )}
              {results.map((r) => (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => addAttendee(r)}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-right text-sm hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {r.phone && (
                      <span className="text-xs text-gray-400" dir="ltr">
                        {r.phone}
                      </span>
                    )}
                    {r.extra && <span className="text-xs text-gray-400">{r.extra}</span>}
                  </span>
                  <Badge variant="outline">{r.kind === 'lead' ? HE.training.lead : HE.training.customer}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </p>
        )}

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
