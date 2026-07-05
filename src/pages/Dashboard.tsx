import { useEffect, useState } from 'react'
import { UserPlus, CalendarClock, Banknote, Hammer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/utils'
import { Card } from '../components/ui/Card'
import { HE } from '../constants/hebrew'

interface Metrics {
  newLeadsToday: number
  meetingsThisWeek: number
  salesThisMonth: number
  pendingInstallations: number
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  useEffect(() => {
    void loadMetrics()
  }, [])

  async function loadMetrics() {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = localDate(startOfWeek(now))
    const weekEnd = localDate(endOfWeek(now))

    const monthStart = localDate(new Date(now.getFullYear(), now.getMonth(), 1))
    const monthEnd = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    const [leadsRes, meetingsRes, salesRes, installationsRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .gte('scheduled_date', weekStart)
        .lte('scheduled_date', weekEnd),
      supabase.from('sales').select('total_amount').gte('date', monthStart).lte('date', monthEnd),
      supabase
        .from('installations')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'scheduled']),
    ])

    const salesTotal = (salesRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.total_amount ?? 0),
      0,
    )

    setMetrics({
      newLeadsToday: leadsRes.count ?? 0,
      meetingsThisWeek: meetingsRes.count ?? 0,
      salesThisMonth: salesTotal,
      pendingInstallations: installationsRes.count ?? 0,
    })
  }

  const cards = [
    {
      label: HE.dashboard.newLeadsToday,
      value: metrics?.newLeadsToday ?? '—',
      icon: UserPlus,
    },
    {
      label: HE.dashboard.meetingsThisWeek,
      value: metrics?.meetingsThisWeek ?? '—',
      icon: CalendarClock,
    },
    {
      label: HE.dashboard.salesThisMonth,
      value: metrics ? `₪${metrics.salesThisMonth.toLocaleString('he-IL')}` : '—',
      icon: Banknote,
    },
    {
      label: HE.dashboard.pendingInstallations,
      value: metrics?.pendingInstallations ?? '—',
      icon: Hammer,
    },
  ]

  return (
    <div dir="rtl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{HE.dashboard.title}</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary-100 p-3 text-primary-700">
              <card.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
