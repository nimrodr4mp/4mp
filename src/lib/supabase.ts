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

const PAGE_SIZE = 1000

/** Supabase caps a single response at its project "Max rows" setting (1000 by
 *  default) and gives no hint that it truncated, so a plain select() silently
 *  drops rows once a table outgrows that — wrong lists, wrong report totals,
 *  no error. Pass a factory that applies .range() to your query and this pages
 *  through until every row is loaded.
 *
 *  Only for queries that must see the whole result set; anything already
 *  paginated for display (see Leads.tsx) should stay as it is. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await page(from, from + PAGE_SIZE - 1)
    const batch = (data as T[] | null) ?? []
    if (batch.length === 0) break
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

/** fetchAllPages for the common "whole table, optionally ordered" case. */
export async function selectAll<T>(table: string, columns = '*', orderBy?: string): Promise<T[]> {
  return fetchAllPages<T>((from, to) => {
    const query = supabase.from(table).select(columns).range(from, to)
    return orderBy ? query.order(orderBy) : query
  })
}
