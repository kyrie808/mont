import type { ReactNode } from 'react'
import { Target } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics'
import { useMetaMensal, usePedidosDoDia, useSugestaoMetas } from '@/hooks/useMetaMensal'
import {
    AVISO_SEM_META,
    corSemaforo,
    diaDoMesBrasilia,
    indicadorDiario,
    mostrarSugestao,
    ritmoDaMeta,
    rotuloSemaforo,
} from '@/utils/metasMensais'
import { KpiTooltip } from './KpiCardDesktop'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const TOOLTIP =
    'Ritmo: faturado comparado com a meta proporcional aos dias corridos — hoje conta como dia passado. ' +
    'R$/dia: o que falta dividido pelos dias que restam, contando hoje. ' +
    'Pedidos: R$/dia ÷ ticket médio do mês (por pedido), arredondado pra cima. ' +
    'Pedidos hoje: vendas com data de hoje (Brasília), sem canceladas e sem brinde.'

/**
 * Indicador do dia, no topo do Dashboard: quanto falta pra mínima/alvo do MÊS CORRENTE
 * (Brasília) e quantos pedidos/dia isso significa. Independe do mês escolhido no
 * MonthPicker — é a pergunta de hoje.
 */
export function IndicadorMetaDiaria() {
    const hoje = diaDoMesBrasilia()
    const diaISO = `${hoje.ano}-${String(hoje.mes).padStart(2, '0')}-${String(hoje.dia).padStart(2, '0')}`
    const proximo = hoje.mes === 12 ? { ano: hoje.ano + 1, mes: 1 } : { ano: hoje.ano, mes: hoje.mes + 1 }
    const fimDoMes = mostrarSugestao(hoje.dia, hoje.diasNoMes)

    const { data: metrics, isLoading: loadingMetrics } = useDashboardMetrics(hoje.mes, hoje.ano)
    const { data: meta, isLoading: loadingMeta } = useMetaMensal(hoje.ano, hoje.mes)
    const { data: pedidosHoje = 0 } = usePedidosDoDia(diaISO)
    const { data: sugestao } = useSugestaoMetas(proximo.ano, proximo.mes, fimDoMes && !!meta)

    if (loadingMetrics || loadingMeta) {
        return <div className="h-[132px] w-full animate-pulse rounded-xl bg-muted" />
    }

    const faturado = metrics?.financial?.faturamento_mes_atual || 0
    const ticket = metrics?.financial?.ticket_medio_mes_atual || 0
    const titulo = `Meta de ${MESES[hoje.mes - 1]}`

    if (!meta) {
        return (
            <section className="rounded-xl border border-border bg-card p-4 shadow-card">
                <Cabecalho titulo={titulo} />
                <p className="mt-2 text-sm font-medium text-warning-strong">{capitalizar(AVISO_SEM_META)}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Pedidos hoje: <b className="tabular-nums text-foreground">{pedidosHoje}</b>
                </p>
            </section>
        )
    }

    const faixa = { minima: Number(meta.meta_minima), alvo: Number(meta.meta_alvo) }
    const ritmo = ritmoDaMeta({ faturado, meta: faixa, dia: hoje.dia, diasNoMes: hoje.diasNoMes, emCurso: true })
    const ind = indicadorDiario({ faturado, meta: faixa, dia: hoje.dia, diasNoMes: hoje.diasNoMes, ticketMedio: ticket })
    const cor = corSemaforo[ritmo.semaforo]

    return (
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
            <Cabecalho titulo={titulo}>
                {ind.fase !== 'batida' && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', cor.fundo, cor.texto)}>
                        {rotuloSemaforo[ritmo.semaforo]}
                    </span>
                )}
            </Cabecalho>

            {ind.fase === 'batida' ? (
                <p className="mt-2 text-base font-bold text-foreground">Meta do mês batida ✅</p>
            ) : (
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {ind.fase === 'minima' && (
                        <p>
                            Faltam <b className="tabular-nums text-foreground">{formatCurrency(ind.faltaMinima)}</b> para a mínima
                            {' · '}<b className="tabular-nums text-foreground">{formatCurrency(ind.porDiaMinima)}/dia</b>
                        </p>
                    )}
                    <p>
                        Faltam <b className="tabular-nums text-foreground">{formatCurrency(ind.faltaAlvo)}</b> para o alvo
                        {' · '}<b className="tabular-nums text-foreground">{formatCurrency(ind.porDiaAlvo)}/dia</b>
                    </p>
                </div>
            )}

            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-3 text-sm">
                <p className="text-muted-foreground">
                    Pedidos hoje: <b className="tabular-nums text-foreground">{pedidosHoje}</b>
                    {ind.pedidosNecessarios !== null && <> de <b className="tabular-nums text-foreground">{ind.pedidosNecessarios}</b></>}
                </p>
                <p className="text-xs text-muted-foreground">
                    projeção: <span className="tabular-nums">{formatCurrency(ritmo.projecao)}</span>
                </p>
            </div>

            {fimDoMes && sugestao && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Sugestão para o próximo mês: mínima {formatCurrency(sugestao.meta_minima)} / alvo {formatCurrency(sugestao.meta_alvo)}
                </p>
            )}
        </section>
    )
}

function Cabecalho({ titulo, children }: { titulo: string; children?: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
                <Target className="size-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{titulo}</span>
                <KpiTooltip tooltip={TOOLTIP} />
            </div>
            {children}
        </div>
    )
}

function capitalizar(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}
