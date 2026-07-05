import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateId, categoryColorClass, CATEGORY_PALETTE } from '../lib/utils'
import { useAppData } from '../context/AppContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { ConfirmDialog } from '../components/ui/Modal'
import { HE } from '../constants/hebrew'
import type { MachineCategory } from '../types'

const COLOR_KEYS = Object.keys(CATEGORY_PALETTE)

export default function SettingsPage() {
  const { machineCategories, refreshMachineCategories } = useAppData()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MachineCategory | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    setIsSaving(true)
    try {
      const maxOrder = machineCategories.reduce((m, c) => Math.max(m, c.sort_order), 0)
      await supabase.from('machine_categories').insert({
        id: generateId(),
        name: newName.trim(),
        color: newColor,
        sort_order: maxOrder + 1,
      })
      setNewName('')
      setNewColor('blue')
      await refreshMachineCategories()
    } finally {
      setIsSaving(false)
    }
  }

  async function handleColorChange(cat: MachineCategory, color: string) {
    await supabase.from('machine_categories').update({ color }).eq('id', cat.id)
    await refreshMachineCategories()
  }

  async function handleRename(cat: MachineCategory, name: string) {
    if (!name.trim() || name === cat.name) return
    await supabase.from('machine_categories').update({ name: name.trim() }).eq('id', cat.id)
    await refreshMachineCategories()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await supabase.from('machine_categories').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    await refreshMachineCategories()
  }

  return (
    <div dir="rtl">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">{HE.settings.title}</h1>

      <Card className="max-w-2xl p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">{HE.settings.machineCategories}</h2>

        <div className="mb-4 flex flex-col gap-2">
          {machineCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-2">
              <span
                className={
                  'rounded-full px-2.5 py-0.5 text-xs font-medium ' + categoryColorClass(cat.color)
                }
              >
                {cat.name}
              </span>
              <input
                defaultValue={cat.name}
                onBlur={(e) => void handleRename(cat, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm"
              />
              <Select
                value={cat.color}
                onChange={(e) => void handleColorChange(cat, e.target.value)}
                className="w-28 py-1"
              >
                {COLOR_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {HE.settings.colorOptions[k as keyof typeof HE.settings.colorOptions] ?? k}
                  </option>
                ))}
              </Select>
              <button
                onClick={() => setDeleteTarget(cat)}
                className="text-gray-400 hover:text-red-600"
                aria-label={HE.common.delete}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {machineCategories.length === 0 && (
            <p className="text-sm text-gray-400">{HE.common.noData}</p>
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-gray-100 pt-4">
          <Input
            label={HE.settings.categoryName}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
          />
          <Select
            label={HE.settings.color}
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-28"
          >
            {COLOR_KEYS.map((k) => (
              <option key={k} value={k}>
                {HE.settings.colorOptions[k as keyof typeof HE.settings.colorOptions] ?? k}
              </option>
            ))}
          </Select>
          <Button onClick={handleAdd} loading={isSaving} disabled={!newName.trim()}>
            <Plus size={16} /> {HE.settings.addCategory}
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        message={HE.settings.deleteCategoryConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />
    </div>
  )
}
