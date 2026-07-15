import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ContatoResumo {
    totalGasto: number      // SUM(vendas.total) — mapeado de ranking_compras.total_pontos
    totalCompras: number    // COUNT(vendas)     — ranking_compras.total_compras
    ultimaCompra: string | null
}

// Fallback estável — evita criar um Map novo a cada render (quebraria o memo de colunas do grid).
const EMPTY_RESUMO: ReadonlyMap<string, ContatoResumo> = new Map()

/**
 * Resumo de compras por contato, reusando a view `ranking_compras` (mesma fonte do
 * ranking em /ranking). Read-only, sem schema novo. Contatos sem compra (HAVING sum>0
 * na view) simplesmente não aparecem no Map → o grid renderiza "—"/R$ 0.
 */
export function useContatosResumo(): ReadonlyMap<string, ContatoResumo> {
    const { data } = useQuery({
        queryKey: ['contatos-resumo'],
        queryFn: async (): Promise<ReadonlyMap<string, ContatoResumo>> => {
            const { data, error } = await supabase
                .from('ranking_compras')
                .select('contato_id, total_pontos, total_compras, ultima_compra')

            if (error) throw error

            const map = new Map<string, ContatoResumo>()
            for (const row of data ?? []) {
                if (!row.contato_id) continue
                map.set(row.contato_id, {
                    totalGasto: Number(row.total_pontos) || 0,
                    totalCompras: Number(row.total_compras) || 0,
                    ultimaCompra: row.ultima_compra,
                })
            }
            return map
        },
        staleTime: 1000 * 60 * 15,
    })

    return data ?? EMPTY_RESUMO
}
