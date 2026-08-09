import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { he } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { formatDate, localDate } from '../lib/utils'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { TrainingSessionModal } from '../components/training/TrainingSessionModal'
import { HE } from '../constants/hebrew'
import type { TrainingSession } from '../types'

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

export default function Training() {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingSession | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    void loadSessions()
  }, [])

  async function loadSessions() {
    const { data, error } = await supabase.from('training_sessions').select('*').order('start_date')
    setLoadError(error ? `${HE.training.loadFailed} ${error.message}` : null)
    setSessions((data as TrainingSession[]) ?? [])
  }

  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(session: TrainingSession) {
    setEditing(session)
    setModalOpen(true)
  }

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 })
    const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [monthCursor])

  function sessionsOnDay(day: Date): TrainingSession[] {
    const key = localDate(day)
    return sessions.filter((s) => key >= s.start_date && key <= s.end_date)
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.training.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.training.addSession}
        </Button>
      </div>

      {loadError && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </p>
      )}

      <Card className="mb-6 p-4">
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            aria-label={HE.training.prevMonth}
            onClick={() => setMonthCursor((m) => subMonths(m, 1))}
          >
            <ChevronRight size={18} />
          </Button>
          <span className="text-sm font-semibold text-gray-900">
            {format(monthCursor, 'LLLL yyyy', { locale: he })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label={HE.training.nextMonth}
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
          >
            <ChevronLeft size={18} />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-400">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const daySessions = sessionsOnDay(day)
            const inMonth = isSameMonth(day, monthCursor)
            return (
              <div
                key={day.toISOString()}
                className={
                  'flex min-h-[76px] flex-col gap-1 rounded-lg border border-gray-100 p-1.5 ' +
                  (inMonth ? 'bg-white' : 'bg-gray-50')
                }
              >
                <span className={inMonth ? 'text-xs text-gray-500' : 'text-xs text-gray-300'}>
                  {day.getDate()}
                </span>
                {daySessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openEdit(s)}
                    className="truncate rounded bg-primary-100 px-1.5 py-0.5 text-right text-[11px] font-medium text-primary-800 hover:bg-primary-200"
                    title={s.name}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </Card>

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">{HE.training.noSessions}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Card key={s.id} className="cursor-pointer p-4" onClick={() => openEdit(s)}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{s.name}</span>
                {s.subject && <Badge variant="info">{s.subject}</Badge>}
              </div>
              <p className="text-xs text-gray-500">
                {formatDate(s.start_date)} – {formatDate(s.end_date)}
              </p>
              {s.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-400">{s.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <TrainingSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => void loadSessions()}
      />
    </div>
  )
}
