import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Validação do payload — preços NÃO vêm do cliente
const orderSchema = z.object({
    customer_name: z.string().min(3),
    customer_phone: z.string().regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$|^\d{10,11}$/, 'Telefone inválido'),
    customer_address: z.string().optional(),
    delivery_method: z.enum(['entrega', 'retirada']),
    payment_method: z.enum(['pix', 'dinheiro']),
    items: z.array(z.object({
        product_id: z.string().uuid(),
        quantity: z.number().int().positive(),
    })).min(1),
    delivery_fee_cents: z.number().int().nonnegative().optional(),
    referred_by: z.string().optional(),
    notes: z.string().optional(),
    customer_cep: z.string().nullable().optional(),
    customer_logradouro: z.string().nullable().optional(),
    customer_numero: z.string().nullable().optional(),
    customer_complemento: z.string().nullable().optional(),
    customer_bairro: z.string().nullable().optional(),
    customer_cidade: z.string().nullable().optional(),
    customer_uf: z.string().nullable().optional(),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Valida payload
        const validatedData = orderSchema.parse(body)

        // --- VERIFICAÇÃO DE PREÇOS SERVER-SIDE ---
        const productIds = validatedData.items.map(i => i.product_id)

        const { data: produtos, error: produtosError } = await supabaseAdmin
            .from('produtos')
            .select('id, nome, preco, ativo, visivel_catalogo')
            .in('id', productIds)

        if (produtosError || !produtos) {
            return NextResponse.json(
                { error: 'Erro ao verificar produtos' },
                { status: 500 }
            )
        }

        // Validar: todos os produtos existem, estão ativos e visíveis
        const produtoMap = new Map(produtos.map(p => [p.id, p]))

        for (const item of validatedData.items) {
            const produto = produtoMap.get(item.product_id)
            if (!produto) {
                return NextResponse.json(
                    { error: `Produto indisponível: ${item.product_id}` },
                    { status: 400 }
                )
            }
            if (!produto.ativo || !produto.visivel_catalogo) {
                return NextResponse.json(
                    { error: `Produto indisponível: ${produto.nome}` },
                    { status: 400 }
                )
            }
        }

        // Recalcular preços a partir do banco
        const itemsComPreco = validatedData.items.map(item => {
            const produto = produtoMap.get(item.product_id)!
            const unit_price_cents = Math.round(Number(produto.preco) * 100)
            return {
                product_id: item.product_id,
                product_name: produto.nome,
                quantity: item.quantity,
                unit_price_cents,
                total_centavos: unit_price_cents * item.quantity,
            }
        })

        const subtotal_cents = itemsComPreco.reduce(
            (acc, i) => acc + i.total_centavos, 0
        )
        // Server-side: força o frete correto — ignora valor enviado pelo cliente
        // Entrega SBC = grátis; retirada = sem frete
        const delivery_fee_cents = 0
        const total_cents = subtotal_cents + delivery_fee_cents

        // Inserir pedido + itens via RPC (transação atômica)
        const { data: pedidoCriado, error: rpcError } = await supabaseAdmin
            .rpc('criar_pedido', {
                p_nome_cliente: validatedData.customer_name,
                p_telefone_cliente: validatedData.customer_phone,
                p_endereco_entrega: validatedData.customer_address || null,
                p_metodo_entrega: validatedData.delivery_method,
                p_metodo_pagamento: validatedData.payment_method,
                p_subtotal_centavos: subtotal_cents,
                p_frete_centavos: delivery_fee_cents,
                p_total_centavos: total_cents,
                p_observacoes: validatedData.notes || null,
                p_indicado_por: validatedData.referred_by || null,
                p_itens: itemsComPreco,
                p_cep: validatedData.customer_cep || null,
                p_logradouro: validatedData.customer_logradouro || null,
                p_numero: validatedData.customer_numero || null,
                p_complemento: validatedData.customer_complemento || null,
                p_bairro: validatedData.customer_bairro || null,
                p_cidade: validatedData.customer_cidade || null,
                p_uf: validatedData.customer_uf || null,
            })

        if (rpcError) {
            console.error('Erro ao criar pedido:', rpcError)
            return NextResponse.json(
                { error: 'Erro ao criar pedido' },
                { status: 500 }
            )
        }

        return NextResponse.json(
            { success: true, pedido: pedidoCriado },
            { status: 201 }
        )

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: error.errors },
                { status: 400 }
            )
        }

        console.error('Erro ao processar pedido:', error)
        return NextResponse.json(
            { error: 'Erro ao processar pedido' },
            { status: 500 }
        )
    }
}
