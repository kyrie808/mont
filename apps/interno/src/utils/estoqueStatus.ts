import type { DomainProduto } from '../types/domain'

/**
 * Status de estoque de um produto — fonte ÚNICA da verdade, compartilhada entre a página
 * Estoque (inventário) e a página Produtos (cadastro), pra que "baixo estoque" signifique a
 * MESMA coisa e tenha a MESMA cor nas duas telas.
 *
 * Fallback canônico do mínimo: `estoqueMinimo ?? 0` (mínimo 0/nulo = "sem mínimo" → nunca vira
 * "baixo"; não inventar um limiar 10 fantasma).
 */
export type EstoqueStatus = 'negativo' | 'zerado' | 'baixo' | 'ok'

export function estoqueStatus(p: Pick<DomainProduto, 'estoqueAtual' | 'estoqueMinimo'>): EstoqueStatus {
    const atual = p.estoqueAtual ?? 0
    if (atual < 0) return 'negativo'
    if (atual === 0) return 'zerado'
    if (atual <= (p.estoqueMinimo ?? 0)) return 'baixo'
    return 'ok'
}

/** Rótulo + classes de badge (tokens semânticos) por status — fonte única de estilo. */
export const ESTOQUE_STATUS_BADGE: Record<EstoqueStatus, { label: string; cls: string }> = {
    negativo: { label: 'Negativo', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    zerado: { label: 'Zerado', cls: 'bg-muted text-muted-foreground border-border' },
    baixo: { label: 'Baixo', cls: 'bg-warning/10 text-warning-strong border-warning/20' },
    ok: { label: 'OK', cls: 'bg-success/10 text-success border-success/20' },
}
