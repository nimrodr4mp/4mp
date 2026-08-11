import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { selectAll, supabase } from '../lib/supabase'
import { generateId, categoryColorClass } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { Machine, MachinePrice, MachineVariation } from '../types'

const emptyForm = {
  name: '',
  description: '',
  image_url: '',
  is_active: true,
}

export default function Machines() {
  const { role } = useAuth()
  const { machineCategories, refreshMachines: refreshActiveMachines } = useAppData()
  const canEditPrices = role === 'admin'
  const [machines, setMachines] = useState<Machine[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Machine | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState<string[]>([])
  const [prices, setPrices] = useState<MachinePrice[]>([])
  const [variations, setVariations] = useState<MachineVariation[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const colorFor = (name: string) =>
    categoryColorClass(machineCategories.find((c) => c.name === name)?.color)

  useEffect(() => {
    void loadAllMachines()
  }, [])

  async function loadAllMachines() {
    setMachines(await selectAll<Machine>('machines', '*', 'name'))
  }

  async function refreshMachines() {
    await Promise.all([loadAllMachines(), refreshActiveMachines()])
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setCategories([])
    setPrices([])
    setVariations([])
    setModalOpen(true)
  }

  function openEdit(machine: Machine) {
    setEditing(machine)
    setForm({
      name: machine.name,
      description: machine.description ?? '',
      image_url: machine.image_url ?? '',
      is_active: machine.is_active,
    })
    setCategories(machine.categories ?? (machine.category ? [machine.category] : []))
    setPrices(
      machine.prices?.length
        ? machine.prices
        : machine.price != null
          ? [{ id: generateId(), name: 'מחיר בסיס', amount: machine.price }]
          : [],
    )
    setVariations(machine.variations ?? [])
    setModalOpen(true)
  }

  function toggleCategory(name: string) {
    setCategories((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]))
  }

  function addPrice() {
    setPrices((p) => [...p, { id: generateId(), name: '', amount: 0 }])
  }
  function updatePrice(id: string, patch: Partial<MachinePrice>) {
    setPrices((p) => p.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removePrice(id: string) {
    setPrices((p) => p.filter((item) => item.id !== id))
  }

  function addVariation() {
    setVariations((v) => [...v, { id: generateId(), name: '', price_modifier: 0 }])
  }
  function updateVariation(id: string, patch: Partial<MachineVariation>) {
    setVariations((v) => v.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  function removeVariation(id: string) {
    setVariations((v) => v.filter((item) => item.id !== id))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const cleanPrices = prices.filter((p) => p.name.trim() || p.amount)
      const payload: Record<string, unknown> = {
        name: form.name,
        categories,
        description: form.description || null,
        image_url: form.image_url || null,
        is_active: form.is_active,
        variations,
        // legacy single-value mirrors for backward compatibility
        category: categories[0] ?? null,
        updated_at: new Date().toISOString(),
      }
      // Only admins may write prices; preserve existing on non-admin edits.
      if (canEditPrices) {
        payload.prices = cleanPrices
        payload.price = cleanPrices[0]?.amount ?? null
      }
      if (editing) {
        await supabase.from('machines').update(payload).eq('id', editing.id)
      } else {
        await supabase
          .from('machines')
          .insert({ id: generateId(), prices: canEditPrices ? cleanPrices : [], ...payload })
      }
      setModalOpen(false)
      await refreshMachines()
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleActive(machine: Machine) {
    await supabase.from('machines').update({ is_active: !machine.is_active }).eq('id', machine.id)
    await refreshMachines()
  }

  function priceSummary(machine: Machine): string {
    const list = machine.prices?.length
      ? machine.prices.map((p) => p.amount)
      : machine.price != null
        ? [machine.price]
        : []
    if (list.length === 0) return '—'
    const min = Math.min(...list)
    const max = Math.max(...list)
    return min === max
      ? `₪${min.toLocaleString('he-IL')}`
      : `₪${min.toLocaleString('he-IL')} – ₪${max.toLocaleString('he-IL')}`
  }

  return (
    <div dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{HE.machines.title}</h1>
        <Button onClick={openNew}>
          <Plus size={16} /> {HE.machines.addMachine}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {machines.map((machine) => {
          const cats = machine.categories?.length
            ? machine.categories
            : machine.category
              ? [machine.category]
              : []
          return (
            <Card key={machine.id} className="cursor-pointer p-4" onClick={() => openEdit(machine)}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{machine.name}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {cats.length === 0 && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {HE.machines.noCategory}
                    </span>
                  )}
                  {cats.map((c) => (
                    <span
                      key={c}
                      className={'rounded-full px-2 py-0.5 text-xs font-medium ' + colorFor(c)}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500">{priceSummary(machine)}</p>
              <label
                className="mt-2 flex items-center gap-1.5 text-xs text-gray-500"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={machine.is_active}
                  onChange={() => void toggleActive(machine)}
                />
                {HE.common.active}
              </label>
            </Card>
          )
        })}
        {machines.length === 0 && <p className="text-sm text-gray-400">{HE.common.noData}</p>}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? HE.machines.editMachine : HE.machines.addMachine}
      >
        <div className="flex flex-col gap-4">
          <Input
            label={HE.common.name}
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {HE.machines.categories}
            </label>
            <div className="flex flex-wrap gap-2">
              {machineCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.name)}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-medium ' +
                    (categories.includes(cat.name)
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700')
                  }
                >
                  {cat.name}
                </button>
              ))}
              {machineCategories.length === 0 && (
                <p className="text-xs text-gray-400">{HE.common.noData}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{HE.machines.description}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <Input
            label={HE.machines.imageUrl}
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
          />

          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            {HE.common.active}
          </label>

          {/* Prices — admin only */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{HE.machines.prices}</label>
              {canEditPrices && (
                <Button size="xs" variant="outline" onClick={addPrice}>
                  <Plus size={14} /> {HE.machines.addPrice}
                </Button>
              )}
            </div>
            {!canEditPrices && (
              <p className="mb-2 text-xs text-gray-400">{HE.machines.adminOnlyPrices}</p>
            )}
            <div className="flex flex-col gap-2">
              {prices.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={HE.machines.priceName}
                    value={p.name}
                    disabled={!canEditPrices}
                    onChange={(e) => updatePrice(p.id, { name: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
                  />
                  <input
                    type="number"
                    placeholder={HE.machines.priceAmount}
                    value={p.amount}
                    disabled={!canEditPrices}
                    onChange={(e) => updatePrice(p.id, { amount: Number(e.target.value) })}
                    className="w-32 rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
                  />
                  {canEditPrices && (
                    <button onClick={() => removePrice(p.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {prices.length === 0 && <p className="text-xs text-gray-300">{HE.common.noData}</p>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{HE.machines.variations}</label>
              <Button size="xs" variant="outline" onClick={addVariation}>
                <Plus size={14} /> {HE.machines.addVariation}
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {variations.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={HE.machines.variationName}
                    value={v.name}
                    onChange={(e) => updateVariation(v.id, { name: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    placeholder={HE.machines.priceModifier}
                    value={v.price_modifier}
                    disabled={!canEditPrices}
                    onChange={(e) => updateVariation(v.id, { price_modifier: Number(e.target.value) })}
                    className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-xs disabled:bg-gray-100"
                  />
                  <button onClick={() => removeVariation(v.id)} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
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
