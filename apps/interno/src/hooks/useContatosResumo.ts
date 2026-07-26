import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface ContatoResumo {
    totalGasto: number      // SUM(produto sem frete) das vendas ENTREGUES (inclui fiado)
    totalCompras: number    // COUNT das vendas ENTREGUES não-brinde
    ultimaCompra: string | null
}

// Fallback estável — evita criar um Map novo a cada render (quebraria o memo de colunas do grid).
const EMPTY_RESUMO: ReadonlyMap<string, ContatoResumo> = new Map()

/**
 * Resumo de compras por contato pela view `contato_compras_resumo`: vendas ENTREGUES
 * não-brinde, SEM exigir pagamento. "Comprou" = recebeu o produto (inclui fiado) — é a base
 * do segmento (quem comprou não é 'lead'). Contato sem entrega não aparece no Map → 'lead'.
 * (Diferente de `ranking_compras`, que exige `pago=true` e é do /ranking de pontos.)
 */
export function useContatosResumo(): ReadonlyMap<string, ContatoResumo> {
    const { data } = useQuery({
        queryKey: ['contatos-resumo'],
        queryFn: async (): Promise<ReadonlyMap<string, ContatoResumo>> => {
            const { data, error } = await supabase
                .from('contato_compras_resumo')
                .select('contato_id, total_compras, total_gasto, ultima_compra')

            if (error) throw error

            const map = new Map<string, ContatoResumo>()
            for (const row of data ?? []) {
                if (!row.contato_id) continue
                map.set(row.contato_id, {
                    totalGasto: Number(row.total_gasto) || 0,
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
