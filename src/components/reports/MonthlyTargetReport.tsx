import { useCallback, useEffect, useMemo, useState } from 'react'
import { Target, TrendingUp, Banknote, Pencil, AlertTriangle } from 'lucide-react'
import { fetchAllPages, supabase } from '../../lib/supabase'
import { generateId, localDate } from '../../lib/utils'
import { ownSalesPersonId } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppContext'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { HE } from '../../constants/hebrew'
import type { Lead, LeadStatus, Sale, SalesTarget } from '../../types'

/** Only 'בתהליך' counts towards potential. Every other open status is either
 *  too early to price or already history: a lead is marked בתהליך once it is
 *  genuinely being worked, and in practice that is also the point where the
 *  ערך כספי actually gets filled in — so this is the one status whose values
 *  are complete enough to add up. 'won' would in any case double-count, since
 *  a won lead already shows up under actual sales. */
const PIPELINE_LEAD_STATUSES: LeadStatus[] = ['in_progress']

function currentMonth(): string {
  return localDate().slice(0, 7)
}

/** First and last day of a 'YYYY-MM' month, as the YYYY-MM-DD strings that
 *  sales.date holds. Day 0 of the next month is the last day of this one. */
function monthBounds(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number)
  return { from: `${month}-01`, to: localDate(new Date(year, m, 0)) }
}

function shekel(value: number): string {
  return `₪${Math.round(value).toLocaleString('he-IL')}`
}

interface Tier {
  bar: string
  text: string
  chip: string
  card: string
}

/** One colour scale across the whole report, so the hue alone says how the
 *  month is going: red behind, amber closing, green at or past the target. */
function tierFor(percent: number | null): Tier {
  if (percent === null) {
    return {
      bar: 'bg-gray-300',
      text: 'text-gray-500',
      chip: 'bg-gray-100 text-gray-600',
      card: 'border-gray-200',
    }
  }
  if (percent >= 100) {
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-700',
      chip: 'bg-emerald-100 text-emerald-800',
      card: 'border-emerald-300',
    }
  }
  if (percent >= 50) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      chip: 'bg-amber-100 text-amber-800',
      card: 'border-amber-300',
    }
  }
  return {
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    chip: 'bg-rose-100 text-rose-800',
    card: 'border-rose-300',
  }
}

interface Totals {
  pipelineValue: number
  pipelineLeads: number
  valuedLeads: number
  salesValue: number
  salesCount: number
}

const EMPTY_TOTALS: Totals = {
  pipelineValue: 0,
  pipelineLeads: 0,
  valuedLeads: 0,
  salesValue: 0,
  salesCount: 0,
}

export function MonthlyTargetReport() {
  const { role, user } = useAuth()
  const { salesPersons } = useAppData()

  const [month, setMonth] = useState(currentMonth())
  // Admins pick whose board they are looking at; everyone else is pinned to
  // their own by ownSalesPersonId, the same rule the lead lists use.
  const lockedTo = role ? ownSalesPersonId(role, user?.sales_person_id) : null
  const [pickedPerson, setPickedPerson] = useState('')
  const personId = lockedTo ?? pickedPerson

  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS)
  const [target, setTarget] = useState<SalesTarget | null>(null)
  // What to offer an admin who has not set this month yet: last month's number
  // beats an empty box, since targets usually repeat.
  const [suggested, setSuggested] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Without this the save just does nothing when the table is missing or RLS
  // refuses the write, which reads as "the button is broken".
  const [saveError, setSaveError] = useState('')

  const isAdmin = role === 'admin'

  useEffect(() => {
    if (isAdmin && !pickedPerson && salesPersons.length > 0) {
      setPickedPerson(salesPersons[0].id)
    }
  }, [isAdmin, pickedPerson, salesPersons])

  const load = useCallback(async () => {
    if (!personId) return
    setIsLoading(true)
    const { from, to } = monthBounds(month)

    const [leads, sales, targetRes, prevRes] = await Promise.all([
      // Paged: only a handful sit at בתהליך today, but a truncated read would
      // quietly understate the pipeline rather than fail, so don't rely on that.
      fetchAllPages<Pick<Lead, 'deal_value'>>((rangeFrom, rangeTo) =>
        supabase
          .from('leads')
          .select('deal_value')
          .eq('assigned_to', personId)
          .eq('is_archived', false)
          .in('status', PIPELINE_LEAD_STATUSES)
          .range(rangeFrom, rangeTo),
      ),
      fetchAllPages<Pick<Sale, 'total_amount'>>((rangeFrom, rangeTo) =>
        supabase
          .from('sales')
          .select('total_amount')
          .eq('sales_person_id', personId)
          .neq('status', 'cancelled')
          .gte('date', from)
          .lte('date', to)
          .range(rangeFrom, rangeTo),
      ),
      supabase
        .from('sales_targets')
        .select('*')
        .eq('sales_person_id', personId)
        .eq('month', month)
        .maybeSingle(),
      supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('sales_person_id', personId)
        .lt('month', month)
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    let pipelineValue = 0
    let valuedLeads = 0
    for (const lead of leads) {
      if (lead.deal_value == null) continue
      pipelineValue += Number(lead.deal_value)
      valuedLeads += 1
    }

    const salesValue = sales.reduce((sum, sale) => sum + Number(sale.total_amount ?? 0), 0)

    setTotals({
      pipelineValue,
      pipelineLeads: leads.length,
      valuedLeads,
      salesValue,
      salesCount: sales.length,
    })
    setTarget((targetRes.data as SalesTarget | null) ?? null)
    setSuggested(Number((prevRes.data as { target_amount: number } | null)?.target_amount ?? 0))
    setIsEditing(false)
    setIsLoading(false)
  }, [personId, month])

  useEffect(() => {
    void load()
  }, [load])

  const targetAmount = Number(target?.target_amount ?? 0)
  const hasTarget = targetAmount > 0

  const pct = useCallback(
    (value: number): number | null => (hasTarget ? (value / targetAmount) * 100 : null),
    [hasTarget, targetAmount],
  )

  const salesPct = pct(totals.salesValue)
  const pipelinePct = pct(totals.pipelineValue)
  const gap = Math.max(targetAmount - totals.salesValue, 0)
  const personName = useMemo(
    () => salesPersons.find((sp) => sp.id === personId)?.name ?? '',
    [salesPersons, personId],
  )

  async function saveTarget() {
    if (!personId) return
    setIsSaving(true)
    setSaveError('')
    const amount = Number(draft) || 0
    const { error } = await supabase.from('sales_targets').upsert(
      {
        id: target?.id ?? generateId(),
        sales_person_id: personId,
        month,
        target_amount: amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'sales_person_id,month' },
    )
    setIsSaving(false)
    if (error) {
      setSaveError(`${HE.reports.monthlyTarget.saveFailed} (${error.message})`)
      return
    }
    await load()
  }

  function startEditing() {
    setDraft(String(targetAmount || suggested || ''))
    setSaveError('')
    setIsEditing(true)
  }

  // A non-admin who was never linked to a salesperson has no board to show.
  if (!lockedTo && !isAdmin) {
    return <Card className="p-8 text-center text-gray-400">{HE.reports.monthlyTarget.noSalesPerson}</Card>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filters ── */}
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Input
          label={HE.reports.monthlyTarget.month}
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || currentMonth())}
          className="w-44"
        />
        {isAdmin ? (
          <Select
            label={HE.reports.monthlyTarget.salesperson}
            value={pickedPerson}
            onChange={(e) => setPickedPerson(e.target.value)}
            className="w-52"
          >
            <option value="">{HE.reports.monthlyTarget.pickSalesPerson}</option>
            {salesPersons.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">
              {HE.reports.monthlyTarget.salesperson}
            </span>
            <span className="py-2 text-sm font-semibold text-gray-900">{personName}</span>
          </div>
        )}
      </Card>

      {!personId ? (
        <Card className="p-8 text-center text-gray-400">
          {HE.reports.monthlyTarget.pickSalesPerson}
        </Card>
      ) : (
        <>
          {/* ── The target, front and centre ── */}
          <Card className="overflow-hidden border-0 bg-gradient-to-l from-primary-800 via-primary-600 to-primary-500 p-6 text-white shadow-lg sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2 text-primary-100">
                  <Target size={20} />
                  <span className="text-sm font-medium">
                    {isAdmin
                      ? `${HE.reports.monthlyTarget.target} — ${personName}`
                      : HE.reports.monthlyTarget.targetFor}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-52 rounded-lg border-0 px-3 py-2 text-2xl font-bold text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-white"
                    />
                    <Button variant="outline" onClick={saveTarget} loading={isSaving}>
                      {HE.common.save}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/15"
                      onClick={() => setIsEditing(false)}
                    >
                      {HE.common.cancel}
                    </Button>
                    {saveError && (
                      <p className="w-full rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                        {saveError}
                      </p>
                    )}
                  </div>
                ) : hasTarget ? (
                  <p className="text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
                    {shekel(targetAmount)}
                  </p>
                ) : (
                  <p className="mt-1 text-xl font-semibold text-primary-100">
                    {isAdmin
                      ? HE.reports.monthlyTarget.noTargetAdmin
                      : HE.reports.monthlyTarget.noTarget}
                  </p>
                )}
              </div>

              {isAdmin && !isEditing && (
                <Button
                  variant="outline"
                  onClick={startEditing}
                  className="shrink-0 gap-2 bg-white/95"
                >
                  <Pencil size={16} />
                  {hasTarget
                    ? HE.reports.monthlyTarget.editTarget
                    : HE.reports.monthlyTarget.setTarget}
                </Button>
              )}
            </div>

            {hasTarget && (
              <div className="mt-5 border-t border-white/25 pt-4 text-sm text-primary-50">
                {salesPct !== null && salesPct >= 100 ? (
                  <span className="font-semibold">{HE.reports.monthlyTarget.targetReached}</span>
                ) : (
                  <>
                    {HE.reports.monthlyTarget.gapToTarget}:{' '}
                    <span className="text-lg font-bold tabular-nums">{shekel(gap)}</span>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* ── The two numbers that matter, against the target ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MetricCard
              icon={Banknote}
              label={HE.reports.monthlyTarget.actualSales}
              hint={HE.reports.monthlyTarget.actualSalesHint}
              value={totals.salesValue}
              percent={salesPct}
              footer={`${totals.salesCount} ${HE.reports.monthlyTarget.dealCount}`}
              isLoading={isLoading}
            />
            <MetricCard
              icon={TrendingUp}
              label={HE.reports.monthlyTarget.openPipeline}
              hint={HE.reports.monthlyTarget.openPipelineHint}
              value={totals.pipelineValue}
              percent={pipelinePct}
              footer={`${totals.pipelineLeads} ${HE.reports.monthlyTarget.leadCount} · ${totals.valuedLeads} ${HE.reports.monthlyTarget.valuedLeads}`}
              isLoading={isLoading}
            />
          </div>

          {/* Most leads carry no ערך כספי, so the pipeline figure only counts
              the ones that do. Say so rather than letting it read as the truth. */}
          {totals.pipelineLeads > totals.valuedLeads && (
            <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>
                {HE.reports.monthlyTarget.coverageWarning} — {totals.valuedLeads}/
                {totals.pipelineLeads}
              </span>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  hint,
  value,
  percent,
  footer,
  isLoading,
}: {
  icon: typeof Target
  label: string
  hint: string
  value: number
  percent: number | null
  footer: string
  isLoading: boolean
}) {
  const tier = tierFor(percent)

  return (
    <Card className={`border-2 p-6 ${tier.card}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gray-600">
          <Icon size={20} className={tier.text} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {percent !== null && (
          <span className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${tier.chip}`}>
            {Math.round(percent)}% {HE.reports.monthlyTarget.ofTarget}
          </span>
        )}
      </div>

      <p className={`text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl ${tier.text}`}>
        {isLoading ? '—' : shekel(value)}
      </p>

      {/* Bar is capped at full width; the chip above carries the real number
          once the target is beaten. */}
      <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tier.bar}`}
          style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
        />
      </div>

      <p className="mt-3 text-xs text-gray-500">{hint}</p>
      <p className="mt-1 text-sm font-medium text-gray-700">{footer}</p>
    </Card>
  )
}
