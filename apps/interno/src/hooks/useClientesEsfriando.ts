import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { SEGMENTO_CONFIG } from '../utils/segmentoCliente'

/**
 * "Clientes esfriando" para o sino do Dashboard: bom cliente recorrente que ficou FRIO
 * (`sumido`) mas ainda NÃO virou Inativo (< `inativoDias`) — "acabou de esfriar, dá pra salvar".
 * Deriva da MESMA `view_relacionamento_kanban` do termômetro (fonte única, zero banco novo).
 */
export interface ClienteEsfriando {
    contato_id: string
    nome: string
    telefone: string | null
    total_pedidos: number
    dias_sem_compra: number
    intervalo_medio: number | null
    ultima_compra: string | null
}

const MAX_ITENS = 10

export function useClientesEsfriando() {
    const { data, refetch } = useQuery({
        queryKey: ['clientes-esfriando'],
        queryFn: async (): Promise<ClienteEsfriando[]> => {
            const { data, error } = await supabase
                .from('view_relacionamento_kanban')
                .select('contato_id, nome, telefone, total_pedidos, dias_sem_compra, intervalo_medio, ultima_compra')
                .eq('sumido', true)

            if (error) throw error

            return (data ?? [])
                .filter((r) =>
                    r.contato_id != null &&
                    (r.total_pedidos ?? 0) >= 2 &&
                    (r.dias_sem_compra ?? 9999) < SEGMENTO_CONFIG.inativoDias,
                )
                .map((r) => ({
                    contato_id: r.contato_id as string,
                    nome: r.nome ?? 'Cliente',
                    telefone: r.telefone,
                    total_pedidos: r.total_pedidos ?? 0,
                    dias_sem_compra: r.dias_sem_compra ?? 0,
                    intervalo_medio: r.intervalo_medio,
                    ultima_compra: r.ultima_compra,
                }))
                // mais leal primeiro; empate → o que esfriou há menos tempo (mais salvável)
                .sort((a, b) => b.total_pedidos - a.total_pedidos || a.dias_sem_compra - b.dias_sem_compra)
                .slice(0, MAX_ITENS)
        },
        staleTime: 1000 * 60 * 15,
    })

    const alertas = data ?? []
    return { alertas, count: alertas.length, refetch }
}
