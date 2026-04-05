import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@mont/shared'

export type CatalogoPendente = Tables<'cat_pedidos_pendentes_vinculacao'> & {
    cat_pedidos: Tables<'cat_pedidos'>
}

export function useCatalogoPendentes() {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['catalogo-pendentes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cat_pedidos_pendentes_vinculacao')
                .select(`
                    id, cat_pedido_id, motivo_falha, criado_em,
                    cat_pedidos (
                        id, numero_pedido, nome_cliente, telefone_cliente, 
                        endereco_entrega, metodo_entrega, status, subtotal, 
                        frete, total, metodo_pagamento, status_pagamento, 
                        observacoes, indicado_por, criado_em, atualizado_em, contato_id
                    )
                `)
                .order('criado_em', { ascending: false })

            if (error) throw error
            // Need to cast correctly because select with joins is complex for Supabase types
            return data as unknown as CatalogoPendente[]
        }
    })

    // Mutation para vincular manualmente
    const vincularManualmente = useMutation({
        mutationFn: async ({
            pendenteId,
            catPedidoId,
            contatoId
        }: {
            pendenteId: string,
            catPedidoId: string,
            contatoId: string
        }) => {
            // 1. Buscar dados do pedido
            const { data: pedido, error: errPed } = await supabase
                .from('cat_pedidos')
                .select('*')
                .eq('id', catPedidoId)
                .single()

            if (errPed) throw errPed
            if (!pedido) throw new Error('Pedido não encontrado')

            // 2. Criar a venda manualmente
            const vendaInsert: any = {
                contato_id: contatoId,
                data: pedido.criado_em ? new Date(pedido.criado_em).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                total: pedido.total || 0,
                forma_pagamento: pedido.metodo_pagamento || 'pix',
                status: 'entregue',
                pago: true,
                origem: 'catalogo',
                cat_pedido_id: pedido.id,
                observacoes: `Pedido Catálogo #${pedido.numero_pedido}${pedido.observacoes ? '\n' + pedido.observacoes : ''}`,
                taxa_entrega: pedido.frete || 0
            }

            const { error: errVenda } = await supabase.from('vendas')
                .insert(vendaInsert)

            if (errVenda) throw errVenda

            // 3. Remover da fila de pendentes
            const { error: errDelete } = await supabase
                .from('cat_pedidos_pendentes_vinculacao')
                .delete()
                .eq('id', pendenteId)

            if (errDelete) throw errDelete

            return true
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalogo-pendentes'] })
            queryClient.invalidateQueries({ queryKey: ['vendas'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] })
        }
    })

    return {
        data,
        isLoading,
        error,
        vincularManualmente
    }
}
