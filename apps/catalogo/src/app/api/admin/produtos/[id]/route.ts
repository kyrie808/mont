
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Validation Schema
const updateProductSchema = z.object({
    ativo: z.boolean().optional(),
    visivel_catalogo: z.boolean().optional(),
    descricao: z.string().nullable().optional(),
    categoria: z.string().nullable().optional(),
    peso_kg: z.number().min(0, 'Peso não pode ser negativo').nullable().optional(),
    subtitulo: z.string().nullable().optional(),
    destaque: z.boolean().optional(),
    slug: z.string()
        .regex(/^[a-z0-9_-]+$/, 'Slug deve conter apenas letras minúsculas, números, hífens e underscores')
        .nullable().optional(),
    instrucoes_preparo: z.string().nullable().optional()
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    if (!UUID_REGEX.test(params.id)) {
        return NextResponse.json(
            { error: 'ID inválido' },
            { status: 400 }
        )
    }

    const cookieStore = cookies()

    // 1. Verify Auth
    const authSupabase = createServerClient(
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

    // 2. Parse & Validate Body
    const body = await request.json()
    const result = updateProductSchema.safeParse(body)

    if (!result.success) {
        console.error('ZOD_VALIDATION_ERROR:', JSON.stringify(result.error.issues, null, 2))
        console.error('ZOD_RAW_BODY:', JSON.stringify(body))
        return NextResponse.json({ error: 'Dados inválidos', details: result.error.issues }, { status: 400 })
    }

    // 3. Update Data (Service Role)
    const { data, error } = await supabaseAdmin
        .from('produtos')
        .update(result.data)
        .eq('id', params.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}
