import type { KanbanRow } from '../services/relacionamentoService'

/**
 * Termômetro de engajamento do cliente — momentum relativo ao RITMO dele (não recência
 * absoluta). Derivado 100% do ritmo já calculado na `view_relacionamento_kanban`; ortogonal
 * ao segmento de ciclo de vida (ver `segmentoCliente`). Zero dado novo.
 *
 * Cascata: Novo (<2 compras, sem ritmo) → Frio (sumido) → Quente (dentro do ciclo) → Morno.
 */
export type Temperatura = 'novo' | 'frio' | 'morno' | 'quente'

/** Subconjunto de ritmo consumido — os campos que a view do kanban expõe. */
export type RitmoCliente = Pick<
    KanbanRow,
    'total_pedidos' | 'intervalo_medio' | 'atraso' | 'sumido' | 'dias_sem_compra'
>

export interface TemperaturaResult {
    estado: Temperatura
    /** Frase curta explicando o porquê (ex.: "atrasado 8d vs. ritmo de 20d"). */
    motivo: string
}

/**
 * Classifica a temperatura a partir do ritmo (a kanban row). `null`/sem ritmo/<2 compras = 'novo'.
 * - quente: `atraso < 0` (ainda dentro do ciclo — comprou no ritmo dele)
 * - morno:  `0 <= atraso` e não-sumido (passou da hora, esfriando)
 * - frio:   `sumido` (atraso ≥ 1,5× o ritmo — knob `multiplicador_sumido` da view)
 */
export function temperaturaCliente(ritmo: RitmoCliente | null | undefined): TemperaturaResult {
    const total = ritmo?.total_pedidos ?? 0
    const atraso = ritmo?.atraso
    const intervalo = ritmo?.intervalo_medio

    // Sem ritmo medível (0 ou 1 compra) → Novo.
    if (!ritmo || total < 2 || atraso == null || intervalo == null) {
        return { estado: 'novo', motivo: total === 1 ? '1ª compra — ritmo ainda se formando' : 'sem histórico de compra' }
    }

    const ritmoDias = Math.round(Number(intervalo))
    const semCompra = ritmo.dias_sem_compra ?? 0

    if (ritmo.sumido) {
        return { estado: 'frio', motivo: `sumido · ${semCompra}d sem comprar (ritmo era ~${ritmoDias}d)` }
    }
    if (atraso < 0) {
        return { estado: 'quente', motivo: `no ritmo (~${ritmoDias}d) · última há ${semCompra}d` }
    }
    return { estado: 'morno', motivo: `atrasado ${atraso}d vs. ritmo de ~${ritmoDias}d` }
}

/** Rótulo + classes de badge (tokens do DS) por estado — cor = "quão saudável", não calor literal. */
export const TEMPERATURA_BADGE: Record<Temperatura, { label: string; cls: string }> = {
    quente: { label: 'Quente', cls: 'bg-success/10 text-success border-success/20' },
    morno: { label: 'Morno', cls: 'bg-warning/10 text-warning-strong border-warning/20' },
    frio: { label: 'Frio', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    novo: { label: 'Novo', cls: 'bg-muted text-muted-foreground border-border' },
}

/** Ordem p/ ordenação (mais acionável primeiro: frio → morno → quente → novo). */
export const TEMPERATURA_ORDEM: Record<Temperatura, number> = { frio: 0, morno: 1, quente: 2, novo: 3 }
