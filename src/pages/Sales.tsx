import { useEffect, useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
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
import type {
  BusinessType,
  DeliveryType,
  Sale,
  SaleMachine,
  SalePayment,
  SaleStatus,
} from '../types'

const STATUS_VARIANT: Record<SaleStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  new: 'info',
  confirmed: 'info',
  paid: 'success',
  delivered: 'warning',
  installed: 'success',
  cancelled: 'danger',
}

interface SaleLine {
  key: string
  machine_id: string
  price_id: string
  variation_id: string
  quantity: number
  serial: string
  /** Negotiated unit price. Empty falls back to the catalog price. Kept as a
   *  string so the field can be cleared, and so "0" stays a real override. */
  unit_price: string
}

const emptyLine = (): SaleLine => ({
  key: generateId(),
  machine_id: '',
  price_id: '',
  variation_id: '',
  quantity: 1,
  serial: '',
  unit_price: '',
})

const emptyPaymentLine = (): SalePayment & { key: string } => ({
  key: generateId(),
  type: 'cash',
  amount: 0,
  invoice_link: '',
})

export default function Sales() {
  const { user } = useAuth()
  const { machines, salesPersons, customers, refreshCustomers } = useAppData()
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    type: 'clinic' as BusinessType,
    phone: '',
    email: '',
    city: '',
    address: '',
  })
  const [date, setDate] = useState(localDate())
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()])
  const [payments, setPayments] = useState<(SalePayment & { key: string })[]>([emptyPaymentLine()])
  const [salesPersonId, setSalesPersonId] = useState(user?.sales_person_id ?? '')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery_and_install')
  const [status, setStatus] = useState<SaleStatus>('new')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmInstallOpen, setConfirmInstallOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState<{
    id: string
    customer_id: string | null
    customer_name: string
    phone: string | null
    city: string | null
    address: string | null
    lines: SaleLine[]
  } | null>(null)

  useEffect(() => {
    void loadSales()
  }, [search, statusFilter])

  async function loadSales() {
    const data = await fetchAllPages<Sale>((from, to) => {
      let query = supabase.from('sales').select('*')
      if (statusFilter) query = query.eq('status', statusFilter)
      if (search) query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`)
      return query.order('date', { ascending: false }).range(from, to)
    })
    setSales(data)
  }

  function openNew() {
    setEditingSale(null)
    setCustomerMode('new')
    setCustomerId('')
    setNewCustomer({ name: '', type: 'clinic', phone: '', email: '', city: '', address: '' })
    setDate(localDate())
    setLines([emptyLine()])
    setPayments([emptyPaymentLine()])
    setSalesPersonId(user?.sales_person_id ?? '')
    setLeadPhone('')
    setLeadId(null)
    setDeliveryType('delivery_and_install')
    setStatus('new')
    setNotes('')
    setModalOpen(true)
  }

  function openEdit(sale: Sale) {
    setEditingSale(sale)
    // Never "create new customer" on an edit — that would spawn a duplicate.
    // With no customer_id we keep the sale's own stored customer details.
    setCustomerMode('existing')
    setCustomerId(sale.customer_id ?? '')
    setNewCustomer({ name: '', type: 'clinic', phone: '', email: '', city: '', address: '' })
    setDate(sale.date)
    setLines(
      (sale.machines ?? []).map((m) => ({
        key: generateId(),
        machine_id: m.machine_id,
        price_id: m.price_id ?? '',
        variation_id: m.variation_id ?? '',
        quantity: m.quantity,
        serial: m.serial ?? '',
        // Carry the price actually sold at, so re-saving can't silently
        // reprice the sale against a catalog that has moved since.
        unit_price: m.unit_price != null ? String(m.unit_price) : '',
      })),
    )
    setPayments((sale.payments ?? []).map((p) => ({ ...p, key: generateId() })))
    setSalesPersonId(sale.sales_person_id ?? '')
    setLeadPhone(sale.phone ?? '')
    setLeadId(sale.lead_id ?? null)
    setDeliveryType(sale.delivery_type)
    setStatus(sale.status)
    setNotes(sale.notes ?? '')
    setDetailSale(null)
    setModalOpen(true)
  }

  function addLine() {
    setLines((l) => [...l, emptyLine()])
  }

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((l) => l.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function removeLine(key: string) {
    setLines((l) => l.filter((line) => line.key !== key))
  }

  function addPayment() {
    setPayments((p) => [...p, emptyPaymentLine()])
  }

  function updatePayment(key: string, patch: Partial<SalePayment>) {
    setPayments((p) => p.map((pay) => (pay.key === key ? { ...pay, ...patch } : pay)))
  }

  function removePayment(key: string) {
    setPayments((p) => p.filter((pay) => pay.key !== key))
  }

  function basePriceFor(line: SaleLine): number {
    const machine = machines.find((m) => m.id === line.machine_id)
    if (!machine) return 0
    const priceOpt = machine.prices?.find((p) => p.id === line.price_id)
    if (priceOpt) return priceOpt.amount
    // fall back to first price option, then legacy single price
    return machine.prices?.[0]?.amount ?? machine.price ?? 0
  }

  /** What the catalog says this line costs per unit, before any override. */
  function catalogUnitPrice(line: SaleLine): number {
    const machine = machines.find((m) => m.id === line.machine_id)
    if (!machine) return 0
    const variation = machine.variations.find((v) => v.id === line.variation_id)
    return basePriceFor(line) + (variation?.price_modifier ?? 0)
  }

  /** The price actually charged: the typed override, else the catalog price. */
  function effectiveUnitPrice(line: SaleLine): number {
    if (line.unit_price.trim() !== '') {
      const override = Number(line.unit_price)
      if (Number.isFinite(override)) return override
    }
    return catalogUnitPrice(line)
  }

  function lineTotal(line: SaleLine): number {
    if (!line.machine_id) return 0
    return effectiveUnitPrice(line) * line.quantity
  }

  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const paymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const paymentsMismatch = payments.length > 0 && paymentsTotal !== total

  async function handleLeadLookup() {
    if (!leadPhone) return
    const { data } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', leadPhone)
      .limit(1)
      .maybeSingle()
    setLeadId(data?.id ?? null)
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      let finalCustomerId = customerId
      let customerName = newCustomer.name
      let customerPhone: string | null = newCustomer.phone || null
      let customerCity: string | null = newCustomer.city || null
      let customerAddress: string | null = newCustomer.address || null
      let customerEmail: string | null = newCustomer.email || null

      if (customerMode === 'new') {
        const newId = generateId()
        await supabase.from('customers').insert({
          id: newId,
          name: newCustomer.name,
          type: newCustomer.type,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
          city: newCustomer.city || null,
          address: newCustomer.address || null,
        })
        finalCustomerId = newId
        await refreshCustomers()
      } else if (customerId) {
        const existing = customers.find((c) => c.id === customerId)
        customerName = existing?.name ?? ''
        customerPhone = existing?.phone ?? null
        customerCity = existing?.city ?? null
        customerAddress = existing?.address ?? null
        customerEmail = existing?.email ?? null
      } else if (editingSale) {
        // Editing a sale that was never tied to a customer record: keep the
        // details it already carries rather than blanking them.
        finalCustomerId = ''
        customerName = editingSale.customer_name
        customerPhone = editingSale.phone ?? null
        customerCity = editingSale.city ?? null
        customerAddress = editingSale.address ?? null
        customerEmail = editingSale.email ?? null
      }

      const machinesPayload: SaleMachine[] = lines
        .filter((l) => l.machine_id)
        .map((l) => {
          const machine = machines.find((m) => m.id === l.machine_id)
          const priceOpt = machine?.prices?.find((p) => p.id === l.price_id) ?? machine?.prices?.[0]
          return {
            machine_id: l.machine_id,
            variation_id: l.variation_id || undefined,
            price_id: priceOpt?.id,
            price_name: priceOpt?.name,
            unit_price: effectiveUnitPrice(l),
            quantity: l.quantity,
            name: machine?.name,
            serial: l.serial || undefined,
          }
        })

      const payload = {
        date,
        customer_id: finalCustomerId || null,
        customer_name: customerName,
        phone: customerPhone,
        email: customerEmail,
        city: customerCity,
        address: customerAddress,
        machines: machinesPayload,
        total_amount: total,
        payments: payments.map(({ key: _key, ...p }) => p),
        sales_person: salesPersons.find((sp) => sp.id === salesPersonId)?.name,
        sales_person_id: salesPersonId || null,
        lead_id: leadId,
        delivery_type: deliveryType,
        status,
        notes: notes || null,
      }

      const saleId = editingSale?.id ?? generateId()
      if (editingSale) {
        await supabase
          .from('sales')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', saleId)
      } else {
        await supabase.from('sales').insert({ id: saleId, ...payload })
      }

      setModalOpen(false)
      void loadSales()

      // Only on a brand-new sale: re-offering this on every edit would create
      // duplicate installation tasks for machines already scheduled.
      if (!editingSale && deliveryType === 'delivery_and_install') {
        setLastSaved({
          id: saleId,
          customer_id: finalCustomerId || null,
          customer_name: customerName,
          phone: customerPhone,
          city: customerCity,
          address: customerAddress,
          lines,
        })
        setConfirmInstallOpen(true)
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateInstallations() {
    if (!lastSaved) return
    const rows = lastSaved.lines
      .filter((l) => l.machine_id)
      .map((l) => ({
        id: generateId(),
        sale_id: lastSaved.id,
        customer_id: lastSaved.customer_id,
        customer_name: lastSaved.customer_name,
        phone: lastSaved.phone,
        city: lastSaved.city,
        address: lastSaved.address,
        machine_id: l.machine_id,
        machine_name: machines.find((m) => m.id === l.machine_id)?.name,
        serial_number: l.serial || null,
        status: 'pending' as const,
      }))
    if (rows.length > 0) {
      await supabase.from('installations').insert(rows)
    }
    setConfirmInstallOpen(false)
    setLastSaved(null)
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{HE.sales.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.sales.addSale}
        </Button>
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={HE.leads.searchPlaceholder}
            className="rounded-lg border border-gray-300 py-2 pl-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">{HE.common.status}</option>
          {Object.entries(HE.saleStatus).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-right text-xs text-gray-400">
              <th className="px-4 py-3 font-medium">{HE.common.date}</th>
              <th className="px-4 py-3 font-medium">{HE.customers.title}</th>
              <th className="px-4 py-3 font-medium">{HE.common.phone}</th>
              <th className="px-4 py-3 font-medium">{HE.common.city}</th>
              <th className="px-4 py-3 font-medium">{HE.sales.machinesSection}</th>
              <th className="px-4 py-3 font-medium">{HE.common.total}</th>
              <th className="px-4 py-3 font-medium">{HE.meetings.salesperson}</th>
              <th className="px-4 py-3 font-medium">{HE.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr
                key={sale.id}
                onClick={() => setDetailSale(sale)}
                className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">{formatDate(sale.date)}</td>
                <td className="px-4 py-3">{sale.customer_name}</td>
                <td className="px-4 py-3">{sale.phone}</td>
                <td className="px-4 py-3">{sale.city}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {sale.machines.slice(0, 2).map((m, i) => (
                      <Badge key={i} variant="outline">
                        {m.name}
                      </Badge>
                    ))}
                    {sale.machines.length > 2 && (
                      <Badge variant="outline">+{sale.machines.length - 2}</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">₪{sale.total_amount.toLocaleString('he-IL')}</td>
                <td className="px-4 py-3">{sale.sales_person}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[sale.status]}>{HE.saleStatus[sale.status]}</Badge>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {HE.common.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!detailSale}
        onClose={() => setDetailSale(null)}
        title={HE.sales.saleDetails}
        size="lg"
      >
        {detailSale && (
          <div className="flex flex-col gap-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <p><span className="text-gray-400">{HE.common.date}: </span>{formatDate(detailSale.date)}</p>
              <p><span className="text-gray-400">{HE.customers.title}: </span>{detailSale.customer_name}</p>
              <p><span className="text-gray-400">{HE.common.phone}: </span>{detailSale.phone}</p>
              <p><span className="text-gray-400">{HE.common.city}: </span>{detailSale.city}</p>
              <p><span className="text-gray-400">{HE.sales.deliveryType}: </span>{HE.deliveryType[detailSale.delivery_type]}</p>
              <p><span className="text-gray-400">{HE.common.status}: </span>{HE.saleStatus[detailSale.status]}</p>
            </div>
            <div>
              <p className="mb-2 font-semibold text-gray-700">{HE.sales.machinesSection}</p>
              <div className="flex flex-col gap-1">
                {detailSale.machines.map((m, i) => (
                  <div key={i} className="flex justify-between rounded-lg bg-gray-50 p-2 text-xs">
                    <span>{m.name}</span>
                    <span>{HE.sales.quantity}: {m.quantity}</span>
                    {m.serial && <span>{HE.sales.serial}: {m.serial}</span>}
                    {m.unit_price != null && (
                      <span>
                        {HE.sales.unitPrice}: ₪{Number(m.unit_price).toLocaleString('he-IL')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-base font-semibold">
              {HE.common.total}: ₪{detailSale.total_amount.toLocaleString('he-IL')}
            </p>
            {detailSale.notes && <p className="text-gray-500">{detailSale.notes}</p>}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button variant="outline" onClick={() => setDetailSale(null)}>
                {HE.common.close}
              </Button>
              <Button onClick={() => openEdit(detailSale)}>{HE.common.edit}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSale ? HE.sales.editSale : HE.sales.addSale}
        size="xl"
      >
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={customerMode === 'new'}
                  onChange={() => setCustomerMode('new')}
                />
                {HE.customers.createNew}
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={customerMode === 'existing'}
                  onChange={() => setCustomerMode('existing')}
                />
                {HE.customers.pickExisting}
              </label>
            </div>
            {customerMode === 'existing' ? (
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">-</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={HE.common.name}
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                />
                <Select
                  label={HE.customers.customerType}
                  value={newCustomer.type}
                  onChange={(e) =>
                    setNewCustomer((c) => ({ ...c, type: e.target.value as BusinessType }))
                  }
                >
                  {Object.entries(HE.businessType).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
                <Input
                  label={HE.common.phone}
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                />
                <Input
                  label={HE.common.email}
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                />
                <Input
                  label={HE.common.city}
                  value={newCustomer.city}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, city: e.target.value }))}
                />
                <Input
                  label={HE.common.address}
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, address: e.target.value }))}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label={HE.common.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select
              label={HE.meetings.salesperson}
              value={salesPersonId}
              onChange={(e) => setSalesPersonId(e.target.value)}
            >
              <option value="">-</option>
              {salesPersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </Select>
            <Select
              label={HE.sales.deliveryType}
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
            >
              {Object.entries(HE.deliveryType).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Input
              label={HE.sales.linkLead + ' (' + HE.sales.searchByPhone + ')'}
              value={leadPhone}
              onChange={(e) => setLeadPhone(e.target.value)}
              className="flex-1"
            />
            <Button size="sm" variant="outline" onClick={handleLeadLookup}>
              {HE.common.search}
            </Button>
            {leadId && <Badge variant="success">✓</Badge>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{HE.sales.machinesSection}</label>
              <Button size="xs" variant="outline" onClick={addLine}>
                <Plus size={14} /> {HE.sales.addMachineLine}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {lines.map((line) => {
                const machine = machines.find((m) => m.id === line.machine_id)
                const priceOptions = machine?.prices ?? []
                const catalogPrice = catalogUnitPrice(line)
                const isOverridden =
                  line.unit_price.trim() !== '' && Number(line.unit_price) !== catalogPrice
                return (
                  <div
                    key={line.key}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 p-2"
                  >
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={line.machine_id}
                        onChange={(e) => {
                          const m = machines.find((mm) => mm.id === e.target.value)
                          updateLine(line.key, {
                            machine_id: e.target.value,
                            variation_id: '',
                            price_id: m?.prices?.[0]?.id ?? '',
                            // A different machine makes any old override meaningless.
                            unit_price: '',
                          })
                        }}
                        className="col-span-5 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">-</option>
                        {machines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={line.price_id}
                        onChange={(e) => updateLine(line.key, { price_id: e.target.value })}
                        className="col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                        disabled={priceOptions.length === 0}
                      >
                        {priceOptions.length === 0 && <option value="">-</option>}
                        {priceOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₪{p.amount.toLocaleString('he-IL')})
                          </option>
                        ))}
                      </select>
                      <select
                        value={line.variation_id}
                        onChange={(e) => updateLine(line.key, { variation_id: e.target.value })}
                        className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                        disabled={!machine || machine.variations.length === 0}
                      >
                        <option value="">-</option>
                        {machine?.variations.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-3">
                        <input
                          type="number"
                          min={0}
                          value={line.unit_price}
                          placeholder={`${HE.sales.unitPrice}: ${catalogPrice.toLocaleString('he-IL')}`}
                          onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                          title={HE.sales.unitPriceHint}
                          className={
                            'w-full rounded-lg border px-2 py-1.5 text-xs ' +
                            (isOverridden
                              ? 'border-amber-400 bg-amber-50 font-medium'
                              : 'border-gray-300')
                          }
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        title={HE.sales.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                        className="col-span-2 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder={HE.sales.serial}
                        value={line.serial}
                        onChange={(e) => updateLine(line.key, { serial: e.target.value })}
                        className="col-span-4 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                      />
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        {isOverridden && (
                          <span className="text-[10px] text-amber-700 line-through">
                            ₪{catalogPrice.toLocaleString('he-IL')}
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-700">
                          ₪{lineTotal(line).toLocaleString('he-IL')}
                        </span>
                        <button
                          onClick={() => removeLine(line.key)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{HE.sales.payments}</label>
              <Button size="xs" variant="outline" onClick={addPayment}>
                <Plus size={14} /> {HE.sales.addPayment}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {payments.map((p) => (
                <div key={p.key} className="grid grid-cols-12 items-center gap-2">
                  <select
                    value={p.type}
                    onChange={(e) =>
                      updatePayment(p.key, { type: e.target.value as SalePayment['type'] })
                    }
                    className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  >
                    {Object.entries(HE.paymentType).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={p.amount}
                    onChange={(e) => updatePayment(p.key, { amount: Number(e.target.value) })}
                    className="col-span-3 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    placeholder={HE.sales.invoiceLink}
                    value={p.invoice_link}
                    onChange={(e) => updatePayment(p.key, { invoice_link: e.target.value })}
                    className="col-span-5 rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  />
                  <button onClick={() => removePayment(p.key)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {paymentsMismatch && (
              <p className="mt-1 text-xs text-red-600">{HE.sales.paymentMismatch}</p>
            )}
          </div>

          <Select label={HE.common.status} value={status} onChange={(e) => setStatus(e.target.value as SaleStatus)}>
            {Object.entries(HE.saleStatus).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{HE.common.notes}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-base font-semibold">
              {HE.common.total}: ₪{total.toLocaleString('he-IL')}
            </p>
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
        open={confirmInstallOpen}
        message={HE.sales.autoCreateInstallations}
        onConfirm={handleCreateInstallations}
        onCancel={() => {
          setConfirmInstallOpen(false)
          setLastSaved(null)
        }}
      />
    </div>
  )
}
