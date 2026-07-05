import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}

export function generateId(): string {
  return crypto.randomUUID()
}

/** Returns today (or given date) as a local YYYY-MM-DD string, avoiding UTC-shift bugs. */
export function localDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Tailwind badge classes per category color palette key. */
export const CATEGORY_PALETTE: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  pink: 'bg-pink-100 text-pink-800',
  purple: 'bg-purple-100 text-purple-800',
  amber: 'bg-amber-100 text-amber-800',
  teal: 'bg-teal-100 text-teal-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
}

export function categoryColorClass(colorKey: string | undefined): string {
  return CATEGORY_PALETTE[colorKey ?? 'gray'] ?? CATEGORY_PALETTE.gray
}

/** Formats a date string/Date as dd/mm/yyyy using he-IL locale. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}
