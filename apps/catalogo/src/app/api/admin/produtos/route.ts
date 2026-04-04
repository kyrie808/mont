
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
    const cookieStore = cookies()

    // 1. Verify Auth
    const authSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { } // Read-only for auth check
            }
        }
    )

    const { data: { user } } = await authSupabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 })
    }

    // 2. Data Access (Service Role)
    const { data, error } = await supabaseAdmin
        .from('produtos')
        .select('*')
        .order('nome')

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar imagens separadamente
    const { data: imagens } = await supabaseAdmin
        .from('sis_imagens_produto')
        .select('produto_id, url')

    // Merge manual
    const imagensMap = new Map(imagens?.map(i => [i.produto_id, i.url]) ?? [])

    const combinedData = (data || []).map(p => ({
        ...p,
        sis_imagens_produto: imagensMap.has(p.id)
            ? [{ url: imagensMap.get(p.id)! }]
            : []
    }))

    return NextResponse.json(combinedData)
}
