import { supabase } from '../lib/supabase'
import type { DomainCatalogOrder } from '../types/domain'
import { toDomainCatalogOrder } from './mappers'

export const catalogService = {
    async getPedidosByContato(contatoId: string): Promise<DomainCatalogOrder[]> {
        const [pedidosRes, vendasRes] = await Promise.all([
            (supabase
                .from('cat_pedidos') as any)
                .select(`
                    *,
                    itens:cat_itens_pedido(*)
                `)
                .eq('contato_id', contatoId)
                .order('criado_em', { ascending: false }),
            (supabase
                .from('vendas') as any)
                .select('id, cat_pedido_id')
                .eq('contato_id', contatoId)
                .not('cat_pedido_id', 'is', null)
        ])

        if (pedidosRes.error) throw pedidosRes.error

        const vendaMap = new Map(
            (vendasRes.data || []).map((v: any) => [v.cat_pedido_id, v.id])
        )

        return (pedidosRes.data || []).map((order: any) =>
            toDomainCatalogOrder({
                ...order,
                venda_id: vendaMap.get(order.id) ?? null
            })
        )
    }
}
