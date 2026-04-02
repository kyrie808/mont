
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const updateStatusSchema = z.object({
    status: z.enum(['pendente', 'confirmado', 'preparando', 'enviado', 'entregue', 'cancelado']).optional(),
    status_pagamento: z.enum(['pendente', 'pago', 'parcial']).optional(),
}).refine(data => data.status !== undefined || data.status_pagamento !== undefined, {
    message: 'Informe status ou status_pagamento'
})

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

    const body = await request.json()
    const result = updateStatusSchema.safeParse(body)

    if (!result.success) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }

    const patch: Record<string, string> = {}
    if (result.data.status) patch.status = result.data.status
    if (result.data.status_pagamento) patch.status_pagamento = result.data.status_pagamento

    const { data, error } = await supabaseAdmin
        .from('cat_pedidos')
        .update(patch)
        .eq('id', params.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Integração automática: sincroniza com vendas
    const { data: existingVenda, error: idempotenciaError } = await supabaseAdmin
        .from('vendas')
        .select('id')
        .eq('cat_pedido_id', params.id)
        .maybeSingle()

    if (idempotenciaError) {
        console.error('IDEMPOTENCIA_ERROR:', idempotenciaError)
    }

    if (existingVenda) {
        // Atualiza registro existente em vendas
        const vendaUpdate: Record<string, unknown> = {}

        if (data.status === 'entregue') {
            vendaUpdate.status = 'entregue'
        } else if (data.status === 'cancelado') {
            vendaUpdate.status = 'cancelada'
        } else {
            vendaUpdate.status = 'pendente'
        }

        if (data.status_pagamento === 'pago') {
            vendaUpdate.pago = true
            vendaUpdate.valor_pago = data.total_centavos / 100
        } else {
            vendaUpdate.pago = false
            vendaUpdate.valor_pago = 0
        }

        const { error: updateError } = await supabaseAdmin
            .from('vendas')
            .update(vendaUpdate)
            .eq('cat_pedido_id', params.id)

        if (updateError) {
            console.error('VENDA_UPDATE_ERROR:', updateError)
        }
    } else {
        // Get or create contato pelo telefone
        let contatoId: string | null = null

        const { data: contatoExistente, error: contatoError } = await supabaseAdmin
            .from('contatos')
            .select('id')
            .eq('telefone', data.telefone_cliente)
            .maybeSingle()

        if (contatoExistente) {
            contatoId = contatoExistente.id

            // Atualiza endereço do contato existente com dados do pedido
            if (data.endereco_entrega) {
                await supabaseAdmin
                    .from('contatos')
                    .update({
                        endereco: data.endereco_entrega || null,
                    })
                    .eq('id', contatoExistente.id)
            }
        } else {
            const { data: novoContato, error: contatoCreateError } = await supabaseAdmin
                .from('contatos')
                .insert({
                    nome: data.nome_cliente,
                    telefone: data.telefone_cliente,
                    tipo: 'B2C',
                    origem: 'catalogo',
                    status: 'cliente',
                    endereco: data.endereco_entrega || null,
                })
                .select('id')
                .single()

            if (!contatoCreateError && novoContato) {
                contatoId = novoContato.id
            } else {
                console.error('CONTATO_CREATE_ERROR:', contatoCreateError)
            }
        }

        // Cria registro em vendas (fallback)
        const { error: vendaError } = await supabaseAdmin
            .from('vendas')
            .insert({
                origem: 'catalogo',
                status: data.status === 'entregue' ? 'entregue' : (data.status === 'cancelado' ? 'cancelada' : 'pendente'),
                total: data.total_centavos / 100,
                forma_pagamento: data.metodo_pagamento,
                pago: data.status_pagamento === 'pago',
                valor_pago: data.status_pagamento === 'pago' ? data.total_centavos / 100 : 0,
                taxa_entrega: data.frete_centavos / 100,
                observacoes: data.observacoes || null,
                cat_pedido_id: params.id,
                data: new Date().toISOString().split('T')[0],
                contato_id: contatoId,
            })
        console.error('VENDA_ERROR:', vendaError)
    }

    return NextResponse.json(data)
}

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

    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Buscar venda vinculada
    const { data: venda } = await supabaseAdmin
        .from('vendas')
        .select('id')
        .eq('cat_pedido_id', params.id)
        .maybeSingle()

    if (venda) {
        // Sequência de deleção em cascata Jarvis:
        // 1. Lancamentos
        await supabaseAdmin.from('lancamentos').delete().eq('venda_id', venda.id)

        // 2. Pagamentos
        await supabaseAdmin.from('pagamentos_venda').delete().eq('venda_id', venda.id)

        // 3. Itens da Venda
        await supabaseAdmin.from('itens_venda').delete().eq('venda_id', venda.id)

        // 4. A própria Venda
        await supabaseAdmin.from('vendas').delete().eq('id', venda.id)
    }

    // Sequência de deleção Catálogo:
    // 5. Itens do Pedido (Catálogo)
    await supabaseAdmin.from('cat_itens_pedido').delete().eq('pedido_id', params.id)

    // 6. O Pedido do Catálogo
    const { error: deleteOrderError } = await supabaseAdmin
        .from('cat_pedidos')
        .delete()
        .eq('id', params.id)

    if (deleteOrderError) {
        return NextResponse.json({ error: deleteOrderError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
