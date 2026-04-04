import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@mont/shared'

const updateProductSchema = z.object({
    nome: z.string().optional(),
    subtitulo: z.string().optional(),
    descricao: z.string().optional(),
    preco: z.number().optional(),
    categoria: z.string().optional(),
    estoque_atual: z.number().optional(),
    visivel_catalogo: z.boolean().optional(),
    destaque: z.boolean().optional(),
})

// Admin client with service role for updates/deletes
const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const cookieStore = cookies()
    const { id } = params

    // 1. Verify Auth
    const authSupabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
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

    try {
        const body = await request.json()
        const result = updateProductSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: result.error.flatten() }, { status: 400 })
        }

        const { data, error } = await (supabaseAdmin
            .from('produtos') as any)
            .update(result.data)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Error updating product:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const cookieStore = cookies()
    const { id } = params

    // 1. Verify Auth
    const authSupabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { }
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

    try {
        const { error } = await supabaseAdmin
            .from('produtos')
            .delete()
            .eq('id', id)

        if (error) throw error

        return new NextResponse(null, { status: 204 })
    } catch (error: any) {
        console.error('Error deleting product:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
