import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RitmoCliente } from '../utils/temperaturaCliente'

// Fallback estável — evita novo Map a cada render (quebraria o memo de colunas do grid).
const EMPTY_RITMO: ReadonlyMap<string, RitmoCliente> = new Map()

/**
 * Ritmo por contato (a partir da `view_relacionamento_kanban`, MESMA fonte do kanban — sem
 * duplicar a matemática de cadência) para derivar o termômetro na lista de Clientes.
 * Contato sem linha na view (arquivado / 0 compra) não aparece no Map → termômetro 'novo'.
 */
export function useContatosRitmo(): ReadonlyMap<string, RitmoCliente> {
    const { data } = useQuery({
        queryKey: ['contatos-ritmo'],
        queryFn: async (): Promise<ReadonlyMap<string, RitmoCliente>> => {
            const { data, error } = await supabase
                .from('view_relacionamento_kanban')
                .select('contato_id, total_pedidos, intervalo_medio, atraso, sumido, dias_sem_compra')

            if (error) throw error

            const map = new Map<string, RitmoCliente>()
            for (const row of data ?? []) {
                if (!row.contato_id) continue
                map.set(row.contato_id, {
                    total_pedidos: row.total_pedidos,
                    intervalo_medio: row.intervalo_medio,
                    atraso: row.atraso,
                    sumido: row.sumido,
                    dias_sem_compra: row.dias_sem_compra,
                })
            }
            return map
        },
        staleTime: 1000 * 60 * 15,
    })

    return data ?? EMPTY_RITMO
}
