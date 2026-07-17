import { useQuery } from '@tanstack/react-query'
import { relatorioService, rangeDoPeriodo, type PeriodoRel } from '../services/relatorioService'

const STALE_TIME = 1000 * 60 * 5

/** Chave estável do período para o queryKey. */
function periodoKey(p: PeriodoRel): string {
    return p.tipo === 'geral' ? 'geral' : `${p.ano}-${p.mes}`
}

// ── Clientes ──────────────────────────────────────────────────────────────────

export function useRptLtvPorCliente(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'ltv_por_cliente', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getLtvPorCliente(desde, ate) },
        staleTime: STALE_TIME,
    })
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export function useRptMargemPorSku(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'margem_por_sku', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getMargemPorSku(desde, ate) },
        staleTime: STALE_TIME,
    })
}

export function useRptGiroEstoque(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'giro_estoque', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getGiroEstoque(desde, ate) },
        staleTime: STALE_TIME,
    })
}

// ── Financeiro ────────────────────────────────────────────────────────────────

export function useRptFaturamentoComparativo() {
    return useQuery({
        queryKey: ['relatorio', 'faturamento_comparativo'],
        queryFn: relatorioService.getFaturamentoComparativo,
        staleTime: STALE_TIME,
    })
}

export function useRptDistribuicaoFormaPagamento(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'distribuicao_forma_pagamento', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getDistribuicaoFormaPagamento(desde, ate) },
        staleTime: STALE_TIME,
    })
}

export function useRptProjecaoRecebimentos() {
    return useQuery({
        queryKey: ['relatorio', 'projecao_recebimentos'],
        queryFn: relatorioService.getProjecaoRecebimentos,
        staleTime: STALE_TIME,
    })
}

export function useRptProjecaoPagamentos() {
    return useQuery({
        queryKey: ['relatorio', 'projecao_pagamentos'],
        queryFn: relatorioService.getProjecaoPagamentos,
        staleTime: STALE_TIME,
    })
}

// ── Marketing ─────────────────────────────────────────────────────────────────

export function useRptMarketingPedidos(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'marketing_pedidos', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getMarketingPedidos(desde, ate) },
        staleTime: STALE_TIME,
    })
}
