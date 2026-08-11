import { createClient } from '@supabase/supabase-js'
import { getToken } from './auth'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// The app authenticates with a custom JWT minted by /api/login. supabase-js sends
// that token as the Authorization bearer for every request (falling back to the
// anon key when logged out, which RLS denies).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: async () => getToken(),
})

/** Supabase caps a single response at its project "Max rows" setting (1000 by
 *  default) and gives no hint that it truncated, so a plain select() silently
 *  drops rows once a table outgrows that. Pages through until everything is in. */
export async function selectAll<T>(
  table: string,
  columns = '*',
  orderBy?: string,
): Promise<T[]> {
  const PAGE_SIZE = 1000
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1)
    if (orderBy) query = query.order(orderBy)
    const { data, error } = await query
    if (error || !data || data.length === 0) break
    rows.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows
}
