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
