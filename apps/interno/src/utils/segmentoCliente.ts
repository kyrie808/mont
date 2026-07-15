import type { DomainContato } from '../types/domain'
import type { ContatoResumo } from '../hooks/useContatosResumo'

/**
 * Segmento de ciclo de vida do contato — baldes EXCLUSIVOS (cada contato cai em
 * exatamente um). Derivado do comportamento de compra (view `ranking_compras`),
 * não do campo `contatos.status` (que virou ruído). Ver plano/decisão 15/07/2026.
 */
export type SegmentoCliente = 'lead' | 'cliente' | 'vip' | 'inativo' | 'fornecedor'

export const SEGMENTO_CONFIG = {
    /** Dias sem comprar para virar Inativo. */
    inativoDias: 90,
    /**
     * Compras acumuladas para VIP. 7 ≈ "compra todo mês" nos ~7 meses de história
     * (dez/2025→). BUMP planejado: subir para 12 após 1 ano de operação (~dez/2026).
     */
    vipMinCompras: 7,
    /** Gasto acumulado (R$) para VIP (caminho alternativo à frequência). */
    vipMinGasto: 500,
} as const

/** Parse de 'YYYY-MM-DD' como data LOCAL (evita off-by-one de fuso do `new Date(str)`). */
function parseDataLocal(s: string): Date {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function diasDesde(dataStr: string, hoje: Date): number {
    const ms = hoje.getTime() - parseDataLocal(dataStr).getTime()
    return Math.floor(ms / 86_400_000)
}

/**
 * Classifica um contato num segmento. Cascata (precedência):
 * Fornecedor → Lead (0 compras) → Inativo (>90d) → VIP (≥7 compras OU ≥R$500) → Cliente.
 * Recência antes de VIP: um VIP que parou de comprar vira Inativo (alvo de recuperação).
 */
export function classificarContato(
    contato: Pick<DomainContato, 'tipo' | 'status'>,
    resumo: ContatoResumo | undefined,
    hoje: Date = new Date(),
): SegmentoCliente {
    if (contato.tipo === 'FORNECEDOR' || contato.status === 'fornecedor') return 'fornecedor'

    if (!resumo || resumo.totalCompras === 0) return 'lead'

    if (resumo.ultimaCompra && diasDesde(resumo.ultimaCompra, hoje) > SEGMENTO_CONFIG.inativoDias) {
        return 'inativo'
    }

    if (resumo.totalCompras >= SEGMENTO_CONFIG.vipMinCompras || resumo.totalGasto >= SEGMENTO_CONFIG.vipMinGasto) {
        return 'vip'
    }

    return 'cliente'
}

/** Rótulo + classes de badge (tokens semânticos) por segmento — fonte única de estilo. */
export const SEGMENTO_BADGE: Record<SegmentoCliente, { label: string; cls: string }> = {
    vip: { label: 'VIP', cls: 'bg-primary/10 text-primary border-primary/20' },
    cliente: { label: 'Cliente', cls: 'bg-success/10 text-success border-success/20' },
    lead: { label: 'Lead', cls: 'bg-warning/10 text-warning-strong border-warning/20' },
    inativo: { label: 'Inativo', cls: 'bg-muted text-muted-foreground border-border' },
    fornecedor: { label: 'Fornecedor', cls: 'bg-foreground/5 text-foreground/80 border-foreground/20' },
}
