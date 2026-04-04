import { differenceInDays } from 'date-fns'
import { RECOMPRA_LIMITES } from '../constants'
import type { Contato, Venda } from '@mont/shared'

/**
 * Calcula dias desde a última compra de um contato
 */
export function getDiasDesdUltimaCompra(ultimaCompra: Date | string | null): number {
    if (!ultimaCompra) return Infinity
    let data: Date
    if (typeof ultimaCompra === 'string') {
        if (ultimaCompra.length === 10 && ultimaCompra.includes('-')) {
            data = new Date(`${ultimaCompra}T12:00:00`)
        } else {
            data = new Date(ultimaCompra)
        }
    } else {
        data = ultimaCompra
    }
    return differenceInDays(new Date(), data)
}

/**
 * Determina o status de recompra baseado no ciclo
 */
export function getStatusRecompra(
    diasDesdeUltimaCompra: number,
    ciclo: number
): 'verde' | 'amarelo' | 'vermelho' {
    const porcentagem = diasDesdeUltimaCompra / ciclo

    if (porcentagem <= RECOMPRA_LIMITES.verde) return 'verde'
    if (porcentagem <= RECOMPRA_LIMITES.amarelo) return 'amarelo'
    return 'vermelho'
}

/**
 * Calcula ticket médio de um conjunto de vendas
 */
export function calcularTicketMedio(vendas: Venda[]): number {
    if (vendas.length === 0) return 0
    const total = vendas.reduce((acc, v) => acc + Number(v.total), 0)
    return total / vendas.length
}

/**
 * Calcula faturamento total de um conjunto de vendas
 */
export function calcularFaturamento(vendas: Venda[]): number {
    return vendas.reduce((acc, v) => acc + Number(v.total), 0)
}

/**
 * Calcula margem de lucro
 */
export function calcularMargem(preco: number, custo: number): number {
    if (preco === 0) return 0
    return ((preco - custo) / preco) * 100
}

/**
 * Calcula estatísticas de indicações para um contato
 */
export function calcularEstatisticasIndicacao(
    indicadorId: string,
    todosContatos: Contato[],
    todasVendas: Venda[]
) {
    const indicados = todosContatos.filter(c => c.indicado_por_id === indicadorId)

    const indicacoesConvertidas = indicados.filter(c => c.status === 'cliente').length

    const vendasDosIndicados = todasVendas.filter(v =>
        indicados.some(c => c.id === v.contato_id && c.status === 'cliente')
    )

    const totalComprasIndicados = calcularFaturamento(vendasDosIndicados)

    return {
        totalIndicacoes: indicados.length,
        indicacoesConvertidas,
        totalComprasIndicados,
        indicados,
    }
}

/**
 * Filtra vendas por período
 */
export function filtrarVendasPorPeriodo(
    vendas: Venda[],
    inicio: Date,
    fim: Date
): Venda[] {
    return vendas.filter(v => {
        const data = new Date(`${v.data}T12:00:00`)
        return data >= inicio && data <= fim
    })
}

/**
 * Agrupa vendas por mês
 */
export function agruparVendasPorMes(vendas: Venda[]): Record<string, Venda[]> {
    return vendas.reduce((acc, venda) => {
        const mes = venda.data.slice(0, 7) // YYYY-MM
        if (!acc[mes]) acc[mes] = []
        acc[mes].push(venda)
        return acc
    }, {} as Record<string, Venda[]>)
}

/**
 * Calcula o nível do cliente baseado em compras e indicações
 * Níveis:
 * - 🥉 Bronze (0-2 compras): "Novo"
 * - 🥈 Prata (3-5 compras): "Recorrente"
 * - 🥇 Ouro (6+ compras OU 2+ indicações convertidas): "VIP"
 */
export interface NivelCliente {
    nivel: 'bronze' | 'prata' | 'ouro'
    emoji: string
    label: string
    proximoNivel: string | null
    comprasFaltando: number
}

export function calcularNivelCliente(totalCompras: number, indicacoesConvertidas: number): NivelCliente {
    // Ouro: 6+ compras OU 2+ indicações convertidas
    if (totalCompras >= 6 || indicacoesConvertidas >= 2) {
        return {
            nivel: 'ouro',
            emoji: '🥇',
            label: 'VIP',
            proximoNivel: null,
            comprasFaltando: 0,
        }
    }

    // Prata: 3-5 compras
    if (totalCompras >= 3) {
        return {
            nivel: 'prata',
            emoji: '🥈',
            label: 'Recorrente',
            proximoNivel: 'Ouro',
            comprasFaltando: 6 - totalCompras,
        }
    }

    // Bronze: 0-2 compras
    return {
        nivel: 'bronze',
        emoji: '🥉',
        label: 'Novo',
        proximoNivel: 'Prata',
        comprasFaltando: 3 - totalCompras,
    }
}

