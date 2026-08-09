import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * "A entregar" para o sino do Dashboard: venda que ficou PENDENTE tempo demais.
 *
 * Existe por causa do tipo "Entrego depois" (a venda nasce pendente porque o produto
 * ainda está no carro). Sem esta rede, pendente apodrece: em 08/08/2026 havia 17
 * vendas pendentes, 12 paradas há 8+ dias e uma há 57. Venda parada é estoque que
 * nunca baixou e um recebível que ninguém sabe se existe.
 *
 * O segmento do cliente é efeito colateral MENOR, não o motivo — e vale registrar
 * porque é fácil superdimensionar: `classificarContato` só devolve 'lead' com
 * `totalCompras === 0`, então uma pendente esquecida só rebaixa quem ainda não tem
 * NENHUMA compra entregue. Quem já comprou antes segue Cliente/VIP com quantas
 * pendentes tiver. Na medição de 08/08: das 17 pendentes, 11 eram de clientes já
 * estabelecidos (zero impacto no selo) e só 7 eram primeira compra.
 *
 * Então a venda parada tem que sair daqui por uma das duas portas: foi entregue
 * (marca a entrega) ou não vai acontecer (cancela).
 */
export interface VendaAEntregar {
    venda_id: string
    nome: string
    total: number
    data: string
    dias_parada: number
}

/** Dias pendente a partir dos quais a venda vira alerta. */
export const DIAS_PARA_ALERTAR = 2

const MAX_ITENS = 10

/** Parse de 'YYYY-MM-DD' como data LOCAL (evita off-by-one de fuso). */
function parseDataLocal(s: string): Date {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function diasDesde(dataStr: string, hoje: Date): number {
    const ms = hoje.getTime() - parseDataLocal(dataStr).getTime()
    return Math.floor(ms / 86_400_000)
}

export function useVendasAEntregar() {
    const { data, refetch } = useQuery({
        queryKey: ['vendas-a-entregar'],
        queryFn: async (): Promise<VendaAEntregar[]> => {
            const { data, error } = await supabase
                .from('vendas')
                .select('id, data, total, contato:contatos(nome)')
                .eq('status', 'pendente')
                .order('data', { ascending: true })

            if (error) throw error

            const hoje = new Date()

            return (data ?? [])
                .map((v) => {
                    // O join vem como objeto; PostgREST tipa como array em alguns casos.
                    const contato = v.contato as unknown as { nome: string | null } | null
                    return {
                        venda_id: v.id,
                        nome: contato?.nome ?? 'Cliente',
                        total: Number(v.total ?? 0),
                        data: v.data,
                        dias_parada: diasDesde(v.data, hoje),
                    }
                })
                .filter((v) => v.dias_parada >= DIAS_PARA_ALERTAR)
                // mais parada primeiro — é a que mais corre risco de virar dado errado
                .sort((a, b) => b.dias_parada - a.dias_parada)
                .slice(0, MAX_ITENS)
        },
        staleTime: 1000 * 60 * 15,
    })

    const alertas = data ?? []
    return { alertas, count: alertas.length, refetch }
}
