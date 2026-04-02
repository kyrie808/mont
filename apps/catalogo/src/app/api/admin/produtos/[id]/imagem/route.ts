
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const deleteImageSchema = z.object({
    imageUrl: z.string().url('imageUrl deve ser uma URL válida')
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    // 2. Parse body + validar imageUrl via Zod
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

    // 3. Verificar ownership — imagem pertence ao produto
    const { data: imagemExiste, error: checkError } =
        await supabaseAdmin
            .from('sis_imagens_produto')
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

    // 4. Extrair filePath com new URL()
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

    // 5. Deleta do Storage primeiro
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

    // 6. Só então remove referência do banco
    const { error: dbError } = await supabaseAdmin
        .rpc('delete_image_reference', {
            p_produto_id: params.id,
            p_image_url: imageUrl
        })

    if (dbError) {
        console.error('Erro ao remover referência do banco:', dbError)
        return NextResponse.json(
            { error: 'Arquivo deletado mas erro ao atualizar banco' },
            { status: 500 }
        )
    }

    return NextResponse.json({ success: true })
}
