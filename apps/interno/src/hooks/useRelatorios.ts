import { useQuery } from '@tanstack/react-query'
import { relatorioService } from '../services/relatorioService'

const STALE_TIME = 1000 * 60 * 5

// ── Clientes ──────────────────────────────────────────────────────────────────

export function useRptLtvPorCliente() {
    return useQuery({
        queryKey: ['relatorio', 'ltv_por_cliente'],
        queryFn: relatorioService.getLtvPorCliente,
        staleTime: STALE_TIME,
    })
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export function useRptMargemPorSku() {
    return useQuery({
        queryKey: ['relatorio', 'margem_por_sku'],
        queryFn: relatorioService.getMargemPorSku,
        staleTime: STALE_TIME,
    })
}

export function useRptGiroEstoque() {
    return useQuery({
        queryKey: ['relatorio', 'giro_estoque'],
        queryFn: relatorioService.getGiroEstoque,
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

export function useRptDistribuicaoFormaPagamento() {
    return useQuery({
        queryKey: ['relatorio', 'distribuicao_forma_pagamento'],
        queryFn: relatorioService.getDistribuicaoFormaPagamento,
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

export function useRptMarketingPedidos() {
    return useQuery({
        queryKey: ['relatorio', 'marketing_pedidos'],
        queryFn: relatorioService.getMarketingPedidos,
        staleTime: STALE_TIME,
    })
}

