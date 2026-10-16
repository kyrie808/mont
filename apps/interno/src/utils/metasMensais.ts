import { hojeBrasilia } from '@mont/shared'

/**
 * Metas fixas de faturamento (tabela `metas_mensais`): lógica pura do painel.
 *
 * Convenção de dias (decisão de 16/10/2026):
 *  - RITMO e PROJEÇÃO contam o dia de hoje como PASSADO (dia 16 de 31 → 16/31). Igual ao
 *    ritmo que o painel já usava; fica conservador durante o dia.
 *  - DIAS RESTANTES contam hoje como dia que ainda dá pra vender (dia 16 de 31 → 16 dias).
 *    Por isso a soma passa do mês em 1 — de propósito.
 *  - "Hoje" é sempre o de Brasília (`hojeBrasilia`), nunca o do aparelho nem o UTC.
 */

export type Semaforo = 'verde' | 'amarelo' | 'vermelho'

export interface FaixaMeta {
    minima: number
    alvo: number
}

export interface DiaDoMes {
    ano: number
    mes: number
    dia: number
    diasNoMes: number
}

export function diasNoMes(ano: number, mes: number): number {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/** Ano/mês/dia de hoje em Brasília + quantos dias tem o mês. */
export function diaDoMesBrasilia(now: Date = new Date()): DiaDoMes {
    const [ano, mes, dia] = hojeBrasilia(now).split('-').map(Number)
    return { ano, mes, dia, diasNoMes: diasNoMes(ano, mes) }
}

/** Dias que ainda dá pra vender, INCLUINDO hoje. Último dia do mês → 1. */
export function diasRestantes(dia: number, totalDias: number): number {
    return Math.max(totalDias - dia + 1, 1)
}

/** Últimos 5 dias do mês → hora de mostrar a sugestão do próximo. */
export function mostrarSugestao(dia: number, totalDias: number): boolean {
    return dia > totalDias - 5
}

export interface RitmoMeta {
    /** Fração do mês já corrida (1 em mês fechado). */
    paceFactor: number
    esperadoMinima: number
    esperadoAlvo: number
    semaforo: Semaforo
    pctMinima: number
    pctAlvo: number
    /** faturado / dias passados × dias do mês (mês fechado → o próprio faturado). */
    projecao: number
}

/**
 * Semáforo pelo ritmo: verde = no ritmo do alvo ou acima; amarelo = entre o ritmo da
 * mínima e o do alvo; vermelho = abaixo do ritmo da mínima.
 */
export function ritmoDaMeta(params: {
    faturado: number
    meta: FaixaMeta
    dia: number
    diasNoMes: number
    emCurso: boolean
}): RitmoMeta {
    const { faturado, meta, dia, emCurso } = params
    const total = params.diasNoMes
    const paceFactor = emCurso ? Math.min(dia / total, 1) : 1
    const esperadoMinima = meta.minima * paceFactor
    const esperadoAlvo = meta.alvo * paceFactor

    let semaforo: Semaforo = 'vermelho'
    if (faturado >= esperadoAlvo) semaforo = 'verde'
    else if (faturado >= esperadoMinima) semaforo = 'amarelo'

    return {
        paceFactor,
        esperadoMinima,
        esperadoAlvo,
        semaforo,
        pctMinima: meta.minima > 0 ? (faturado / meta.minima) * 100 : 0,
        pctAlvo: meta.alvo > 0 ? (faturado / meta.alvo) * 100 : 0,
        projecao: emCurso ? (faturado / dia) * total : faturado,
    }
}

/** Em qual degrau o mês está: buscando a mínima, buscando o alvo, ou já bateu tudo. */
export type FaseMeta = 'minima' | 'alvo' | 'batida'

export interface IndicadorDiario {
    fase: FaseMeta
    diasRestantes: number
    faltaMinima: number
    porDiaMinima: number
    faltaAlvo: number
    porDiaAlvo: number
    /**
     * Pedidos/dia pra fechar o degrau da fase atual = ⌈R$/dia ÷ ticket médio do mês⌉.
     * null quando não dá pra calcular (meta batida, ou mês ainda sem venda → sem ticket).
     */
    pedidosNecessarios: number | null
}

export function indicadorDiario(params: {
    faturado: number
    meta: FaixaMeta
    dia: number
    diasNoMes: number
    ticketMedio: number
}): IndicadorDiario {
    const { faturado, meta, dia, ticketMedio } = params
    const restantes = diasRestantes(dia, params.diasNoMes)

    const faltaMinima = Math.max(meta.minima - faturado, 0)
    const faltaAlvo = Math.max(meta.alvo - faturado, 0)
    const porDiaMinima = faltaMinima / restantes
    const porDiaAlvo = faltaAlvo / restantes

    const fase: FaseMeta = faturado >= meta.alvo ? 'batida' : faturado >= meta.minima ? 'alvo' : 'minima'
    const porDiaDaFase = fase === 'minima' ? porDiaMinima : porDiaAlvo

    // Epsilon: 4,0000000001 de ponto flutuante não pode virar 5 pedidos.
    const pedidosNecessarios = fase === 'batida' || ticketMedio <= 0
        ? null
        : Math.ceil(porDiaDaFase / ticketMedio - 1e-9)

    return { fase, diasRestantes: restantes, faltaMinima, porDiaMinima, faltaAlvo, porDiaAlvo, pedidosNecessarios }
}

export const AVISO_SEM_META = 'meta do mês não definida'

/**
 * Mês com linha em `metas_mensais` → faixa fixa. Sem linha → volta ao comportamento
 * anterior (meta = média dos meses fechados) e o painel avisa.
 */
export function resolverMetaFaturamento(
    meta: { meta_minima: number; meta_alvo: number } | null,
    media: number,
): { tipo: 'fixa'; faixa: FaixaMeta } | { tipo: 'media'; media: number; aviso: string } {
    if (meta) return { tipo: 'fixa', faixa: { minima: Number(meta.meta_minima), alvo: Number(meta.meta_alvo) } }
    return { tipo: 'media', media, aviso: AVISO_SEM_META }
}

/**
 * Semáforo do A Receber contra o teto (quanto MENOR, melhor): verde até 80% do limite,
 * amarelo de 80% até o limite, vermelho acima. Sem limite cadastrado → null (nada muda).
 */
export function semaforoAReceber(total: number, limite: number | null): Semaforo | null {
    if (limite === null) return null
    if (total > limite) return 'vermelho'
    if (total > limite * 0.8) return 'amarelo'
    return 'verde'
}

export const rotuloSemaforo: Record<Semaforo, string> = {
    verde: 'no ritmo do alvo',
    amarelo: 'entre mínima e alvo',
    vermelho: 'abaixo da mínima',
}

/** Mês fechado não tem "ritmo": o semáforo vira resultado. */
export const rotuloSemaforoFechado: Record<Semaforo, string> = {
    verde: 'alvo batido',
    amarelo: 'mínima batida',
    vermelho: 'abaixo da mínima',
}

/** Classes de token por estado (mesmos tokens do semáforo do KpiCardDesktop). */
export const corSemaforo: Record<Semaforo, { barra: string; texto: string; fundo: string }> = {
    verde: { barra: 'bg-success', texto: 'text-semantic-green', fundo: 'bg-success/10' },
    amarelo: { barra: 'bg-warning', texto: 'text-warning-strong', fundo: 'bg-warning/10' },
    vermelho: { barra: 'bg-destructive', texto: 'text-destructive', fundo: 'bg-destructive/10' },
}
