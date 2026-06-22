import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ClienteSugerido {
    contatoId: string
    nome: string
    totalCompras: number
}

/**
 * Top clientes por nº de compras (view `ranking_compras`), para sugestão rápida
 * no passo de seleção de cliente da Nova Venda. Focado em "quem mais compra"
 * (order by total_compras), distinto do useRankingCompras (que ordena por pontos).
 */
export function useClientesSugeridos(limit = 5) {
    return useQuery<ClienteSugerido[]>({
        queryKey: ['clientes_sugeridos', limit],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('ranking_compras')
                .select('contato_id, nome, total_compras')
                .order('total_compras', { ascending: false })
                .limit(limit)
            if (error) throw error
            return (data ?? []).map((r) => ({
                contatoId: r.contato_id as string,
                nome: r.nome as string,
                totalCompras: r.total_compras ?? 0,
            }))
        },
        staleTime: 1000 * 60 * 5,
    })
}
