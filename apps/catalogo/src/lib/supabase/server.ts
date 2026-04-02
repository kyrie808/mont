import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createBrowserClient } from '@supabase/supabase-js'

/**
 * Supabase client para Server Components (usa cookies)
 */
export function createClient() {
    const cookieStore = cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options })
                    } catch (error) {
                        // Ignora erro se chamado de Server Component
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options })
                    } catch (error) {
                        // Ignora erro se chamado de Server Component
                    }
                },
            },
        }
    )
}

/**
 * Supabase client anônimo para SSG (não usa cookies)
 * Use para páginas que serão geradas estaticamente
 */
export function createAnonymousClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
