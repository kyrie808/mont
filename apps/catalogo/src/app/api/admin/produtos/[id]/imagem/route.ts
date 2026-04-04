import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database } from '@mont/shared'

const deleteImageSchema = z.object({
    imageUrl: z.string().url('imageUrl deve ser uma URL válida')
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin client with service role for deletion
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

export async function DELETE(
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

    // Role check (assuming admin)
    if (user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 403 })
    }

    // 2. Parse body
    const body = await request.json()
    const parsed = deleteImageSchema.safeParse(body)

    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.errors[0].message },
            { status: 400 }
        )
    }

    const imageUrl = parsed.data.imageUrl
    const parsedUrl = new URL(imageUrl)

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    if (!parsedUrl.origin.includes(new URL(SUPABASE_URL).hostname)) {
        return NextResponse.json(
            { error: 'imageUrl não pertence ao Supabase' },
            { status: 400 }
        )
    }

    // 3. Verificar ownership — imagem pertence ao produto na tabela cat_imagens_produto
    const { data: imagemExiste, error: checkError } =
        await (supabaseAdmin
            .from('cat_imagens_produto') as any)
            .select('id')
            .eq('produto_id', params.id)
            .eq('url', imageUrl)
            .single()

    if (checkError || !imagemExiste) {
        return NextResponse.json(
            { error: 'Imagem não pertence a este produto' },
            { status: 403 }
        )
    }

    // 4. Extrair filePath
    const pathSegments = parsedUrl.pathname.split('/')
    const bucketIndex = pathSegments.findIndex(
        s => s === 'object' || s === 'public'
    )
    const filePath = bucketIndex !== -1
        ? pathSegments.slice(bucketIndex + 2).join('/')
        : pathSegments.pop() ?? ''

    if (!filePath) {
        return NextResponse.json(
            { error: 'Não foi possível extrair o path do arquivo' },
            { status: 400 }
        )
    }

    // 5. Deleta do Storage
    const { error: storageError } = await supabaseAdmin
        .storage
        .from('products')
        .remove([filePath])

    if (storageError) {
        console.error('Erro ao deletar do storage:', storageError)
        return NextResponse.json(
            { error: 'Erro ao deletar arquivo do storage' },
            { status: 500 }
        )
    }

    // 6. Remove referência do banco
    const { error: dbError } = await supabaseAdmin
        .from('cat_imagens_produto')
        .delete()
        .eq('id', imagemExiste.id)

    if (dbError) {
        console.error('Erro ao remover referência do banco:', dbError)
        return NextResponse.json(
            { error: 'Arquivo deletado mas erro ao atualizar banco' },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}
