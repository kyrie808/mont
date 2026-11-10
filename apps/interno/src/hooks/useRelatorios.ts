import { useQuery } from '@tanstack/react-query'
import { relatorioService, rangeDoPeriodo, type FiltroLtv, type PeriodoRel } from '../services/relatorioService'

const STALE_TIME = 1000 * 60 * 5

/** Chave estável do período para o queryKey. */
function periodoKey(p: PeriodoRel): string {
    return p.tipo === 'geral' ? 'geral' : `${p.ano}-${p.mes}`
}

// ── Clientes ──────────────────────────────────────────────────────────────────

/** Totais do LTV no período (contagens e somas feitas no banco). */
export function useRptLtvResumo(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'ltv_resumo', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getLtvResumo(desde, ate) },
        staleTime: STALE_TIME,
    })
}

/** LTV por origem de aquisição (uma linha por origem). */
export function useRptLtvPorOrigem(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'ltv_por_origem', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getLtvPorOrigem(desde, ate) },
        staleTime: STALE_TIME,
    })
}

/** Os N clientes de maior LTV. */
export function useRptLtvTop(periodo: PeriodoRel, limite: number) {
    return useQuery({
        queryKey: ['relatorio', 'ltv_top', periodoKey(periodo), limite],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getLtvTop(desde, ate, limite) },
        staleTime: STALE_TIME,
    })
}

/** Todos os clientes de um filtro (em risco / compraram 1 vez), sem o corte de 1000. */
export function useRptLtvFiltrado(periodo: PeriodoRel, filtro: FiltroLtv) {
    return useQuery({
        queryKey: ['relatorio', 'ltv_filtrado', periodoKey(periodo), filtro],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getLtvFiltrado(desde, ate, filtro) },
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

/** Aquisição mensal por origem (vitalícia; a aba recorta por período no client). */
export function useRptAquisicaoMensal() {
    return useQuery({
        queryKey: ['relatorio', 'aquisicao_mensal'],
        queryFn: relatorioService.getAquisicaoMensal,
        staleTime: STALE_TIME,
    })
}

/** Brindes + descontos concedidos no período (alavancas de promoção). */
export function useRptPromocoes(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'promocoes', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getPromocoes(desde, ate) },
        staleTime: STALE_TIME,
    })
}

/** Ranking de indicações completo (embaixadores) — vitalício. */
export function useRptRankingIndicacoes() {
    return useQuery({
        queryKey: ['relatorio', 'ranking_indicacoes'],
        queryFn: relatorioService.getRankingIndicacoes,
        staleTime: STALE_TIME,
    })
}

/** Campanhas de aquisição (leads/conversão/receita) — vitalício. */
export function useRptCampanhas() {
    return useQuery({
        queryKey: ['relatorio', 'campanhas'],
        queryFn: relatorioService.getCampanhas,
        staleTime: STALE_TIME,
    })
}

/** Gasto diário das campanhas Meta — para a tendência dia-a-dia no modo Mês. */
export function useCampanhasMetricasDiarias() {
    return useQuery({
        queryKey: ['relatorio', 'campanhas_metricas_diarias'],
        queryFn: relatorioService.getMetricasDiarias,
        staleTime: STALE_TIME,
    })
}

/** ROAS por campanha × mês (Meta) — vitalício; a página recorta por período. */
export function useRptCampanhasRoasMensal() {
    return useQuery({
        queryKey: ['relatorio', 'campanhas_roas_mensal'],
        queryFn: relatorioService.getCampanhasRoasMensal,
        staleTime: STALE_TIME,
    })
}

/** Campanhas de promoção (participantes/compraram/receita) — vitalício. */
export function useRptCampanhasPromocao() {
    return useQuery({
        queryKey: ['relatorio', 'campanhas_promocao'],
        queryFn: relatorioService.getCampanhasPromocao,
        staleTime: STALE_TIME,
    })
}

/** Leads por fonte de anúncio — vitalício. */
export function useRptAquisicaoFonte() {
    return useQuery({
        queryKey: ['relatorio', 'aquisicao_fonte'],
        queryFn: relatorioService.getAquisicaoFonte,
        staleTime: STALE_TIME,
    })
}

/** Esforço de contato (tentativas × resposta) no período. */
export function useRptRelacionamentoEsforco(periodo: PeriodoRel) {
    return useQuery({
        queryKey: ['relatorio', 'relacionamento_esforco', periodoKey(periodo)],
        queryFn: () => { const { desde, ate } = rangeDoPeriodo(periodo); return relatorioService.getRelacionamentoEsforco(desde, ate) },
        staleTime: STALE_TIME,
    })
}

/** Funil de trabalho do kanban + base não-alcançável — vitalício. */
export function useRptRelacionamentoFunil() {
    return useQuery({
        queryKey: ['relatorio', 'relacionamento_funil'],
        queryFn: relatorioService.getRelacionamentoFunil,
        staleTime: STALE_TIME,
    })
}
