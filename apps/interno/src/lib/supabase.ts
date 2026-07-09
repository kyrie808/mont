import { createClient } from '@supabase/supabase-js'
import type { Database } from '@mont/shared'
import { fetchComTimeout } from './fetch-timeout'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

// fetchComTimeout aborta requests presos em sinal fraco/morto (ver fetch-timeout.ts).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchComTimeout },
})
