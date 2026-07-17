import { useMemo } from 'react'
import { isMesEmCurso } from '../../utils/calculations'
import { AlertTriangle, DollarSign, PiggyBank, CreditCard } from 'lucide-react'
import {
    useRptFaturamentoComparativo,
    useRptDistribuicaoFormaPagamento,
    useRptProjecaoRecebimentos,
    useRptProjecaoPagamentos,
} from '../../hooks/useRelatorios'
import {
    Sparkline, AreaChart, Donut, StackedTimeline,
    C_MUTED_FG, C_FG, C_MONO,
} from './Charts'
import {
    fmtBRL, fmtBRLk, MES_ABBREV,
    Insight, ChartCard, MiniStat, DeltaPill, EmptyState,
} from './RelatoriosUI'
import type { PeriodoRel } from '../../services/relatorioService'

interface Props { animKey: string | number; periodo: PeriodoRel }

/** Linha do hero do Financeiro (mês selecionado) ou agregado no Geral. */
interface HeroFat {
    ano: number | null
    mes: number | null
    faturamento: number
    lucro_estimado: number
    receita_frete: number
    margem_bruta_pct: number
    faturamento_anterior: number
    variacao_faturamento_percentual: number
}

function pgLabel(forma: string | null): string {
    const s = (forma ?? '').toLowerCase()
    if (s === 'pix') return 'Pix'
    if (s === 'dinheiro') return 'Dinheiro'
    if (s === 'fiado') return 'Fiado'
    if (s.includes('cartao') || s.includes('cartão') || s.includes('card')) return 'Cartão'
    if (s.includes('transfer')) return 'Transferência'
    if (s === 'pre_venda' || s === 'pré_venda') return 'Pré-venda'
    return forma ?? 'Outros'
}

function pgColor(forma: string | null): string {
    const s = (forma ?? '').toLowerCase()
    if (s === 'pix') return '#13ec13'
    if (s === 'dinheiro') return '#10b981'
    if (s === 'fiado') return '#E5A50A'
    if (s.includes('cartao') || s.includes('cartão') || s.includes('card')) return '#3B82F6'
    if (s.includes('transfer')) return '#8b5cf6'
    return '#71717a'
}

export function TabFinanceiro({ animKey, periodo }: Props) {
    const { data: faturamentos = [], isLoading: l1, isError: e1 } = useRptFaturamentoComparativo()
    const { data: formasPgto = [],   isLoading: l2, isError: e2 } = useRptDistribuicaoFormaPagamento(periodo)
    const { data: recebimentos = [], isLoading: l3, isError: e3 } = useRptProjecaoRecebimentos()
    const { data: contasPagar = [],  isLoading: l4, isError: e4 } = useRptProjecaoPagamentos()

    const isLoading = l1 || l2 || l3 || l4
    const isError   = e1 || e2 || e3 || e4

    const isGeral = periodo.tipo === 'geral'

    // Hero + evolução respondem ao período. Mês = linha daquele mês (evolução até ele);
    // Geral = agregado de todos os meses (evolução = todos).
    const { fat, fat8m } = useMemo<{ fat: HeroFat | null; fat8m: { label: string; valor: number }[] }>(() => {
        if (!faturamentos.length) return { fat: null, fat8m: [] }
        const ym = (f: { ano: number | null; mes: number | null }) => (f.ano ?? 0) * 100 + (f.mes ?? 0)
        const asc = [...faturamentos].sort((a, b) => ym(a) - ym(b))

        if (periodo.tipo === 'geral') {
            const soma = (k: 'faturamento' | 'lucro_estimado' | 'receita_frete') =>
                faturamentos.reduce((s, f) => s + (f[k] ?? 0), 0)
            const faturamento = soma('faturamento')
            const lucro = soma('lucro_estimado')
            const heroFat: HeroFat = {
                ano: null, mes: null, faturamento, lucro_estimado: lucro,
                receita_frete: soma('receita_frete'),
                margem_bruta_pct: faturamento > 0 ? Math.round(lucro / faturamento * 1000) / 10 : 0,
                faturamento_anterior: 0, variacao_faturamento_percentual: 0,
            }
            return { fat: heroFat, fat8m: asc.slice(-8).map(f => ({ label: MES_ABBREV[(f.mes ?? 1) - 1], valor: f.faturamento ?? 0 })) }
        }

        const alvo = periodo.ano * 100 + periodo.mes
        const idx = asc.findIndex(f => ym(f) === alvo)
        const row = asc[idx]
        const heroFat: HeroFat = row
            ? {
                ano: row.ano, mes: row.mes, faturamento: row.faturamento ?? 0,
                lucro_estimado: row.lucro_estimado ?? 0, receita_frete: row.receita_frete ?? 0,
                margem_bruta_pct: row.margem_bruta_pct ?? 0,
                faturamento_anterior: row.faturamento_anterior ?? 0,
                variacao_faturamento_percentual: row.variacao_faturamento_percentual ?? 0,
              }
            : { ano: periodo.ano, mes: periodo.mes, faturamento: 0, lucro_estimado: 0, receita_frete: 0,
                margem_bruta_pct: 0, faturamento_anterior: 0, variacao_faturamento_percentual: 0 }
        const upTo = asc.filter(f => ym(f) <= alvo).slice(-8)
        return { fat: heroFat, fat8m: upTo.map(f => ({ label: MES_ABBREV[(f.mes ?? 1) - 1], valor: f.faturamento ?? 0 })) }
    }, [faturamentos, periodo])

    const pagamentos = useMemo(() => formasPgto.map(p => ({
        forma: p.forma_pagamento,
        label: pgLabel(p.forma_pagamento),
        pct: Math.round(p.pct_faturamento ?? 0),
        valor: p.faturamento ?? 0,
        color: pgColor(p.forma_pagamento),
    })), [formasPgto])

    const { timelineData, totalReceber, totalPagar, saldoPrevisto, qtdVendas, qtdContas, atrasados, vencidas } = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const openReceb = recebimentos.filter(r => (r.saldo_aberto ?? 0) > 0)
        const openPagar = contasPagar.filter(p => (p.saldo_devedor ?? 0) > 0)

        const totalReceber = openReceb.reduce((s, r) => s + (r.saldo_aberto ?? 0), 0)
        const totalPagar   = openPagar.reduce((s, p) => s + (p.saldo_devedor ?? 0), 0)
        const qtdVendas  = openReceb.length
        const qtdContas  = openPagar.length

        const atrasados = openReceb
            .filter(r => r.situacao === 'vencido')
            .map(r => ({
                id: r.venda_id ?? Math.random().toString(),
                nome: r.contato_nome ?? '—',
                dias: r.data_prevista_pagamento
                    ? Math.floor((today.getTime() - new Date(r.data_prevista_pagamento).getTime()) / 86400000)
                    : 0,
                valor: r.saldo_aberto ?? 0,
            }))
            .sort((a, b) => b.dias - a.dias)
            .slice(0, 6)

        const vencidas = openPagar.filter(p => (p.dias_atraso ?? 0) > 0).length

        const timelineData = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(today.getTime() + i * 86400000)
            const dateStr = date.toISOString().slice(0, 10)
            const receber = openReceb
                .filter(r => r.data_prevista_pagamento === dateStr)
                .reduce((s, r) => s + (r.saldo_aberto ?? 0), 0)
            const pagar = openPagar
                .filter(p => p.data_vencimento === dateStr)
                .reduce((s, p) => s + (p.saldo_devedor ?? 0), 0)
            return { dia: i + 1, receber, pagar }
        })

        const saldoPrevisto = Math.round(totalReceber) - Math.round(totalPagar)
        return { timelineData, totalReceber, totalPagar, saldoPrevisto, qtdVendas, qtdContas, atrasados, vencidas }
    }, [recebimentos, contasPagar])

    if (isLoading) return <EmptyState msg="Carregando dados financeiros…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados financeiros." />
    if (!fat) return <EmptyState msg="Sem dados financeiros disponíveis." />

    const faturamento = fat.faturamento ?? 0
    const delta       = fat.variacao_faturamento_percentual ?? 0
    const lucroEst    = fat.lucro_estimado ?? 0
    const margemBruta = fat.margem_bruta_pct ?? 0
    const fatAnterior = fat.faturamento_anterior ?? 0
    const receitaFrete = fat.receita_frete ?? 0

    const maxFat = fat8m.reduce((a, b) => a.valor > b.valor ? a : b, { label: '?', valor: 0 })
    const currMesAbrev = fat.mes ? MES_ABBREV[fat.mes - 1] : ''
    const prevMesAbrev = (fat.mes ?? 1) > 1 ? MES_ABBREV[(fat.mes! - 2)] : MES_ABBREV[11]
    const emCurso = !isGeral && isMesEmCurso(fat.ano ?? 0, fat.mes ?? 0)
    const periodoLabel = isGeral ? 'Geral' : `${currMesAbrev}/${fat.ano}`
    const evolHeadline = isGeral
        ? `Todos os tempos · ${fat8m.length} ${fat8m.length === 1 ? 'mês' : 'meses'}.`
        : emCurso
            ? `${currMesAbrev}/${fat.ano} · mês em curso.`
            : `${currMesAbrev} está ${Math.abs(delta).toFixed(1)}% ${delta >= 0 ? 'acima' : 'abaixo'} de ${prevMesAbrev}.`

    const topPg   = pagamentos[0]
    const fiadoPg = pagamentos.find(p => p.forma?.toLowerCase().includes('fiado'))
    const pgInsightSub = fiadoPg
        ? `Fiado representa ${fiadoPg.pct}% · ${fmtBRL(fiadoPg.valor)}`
        : pagamentos[1] ? `${pagamentos[1].label}: ${pagamentos[1].pct}% · ${fmtBRL(pagamentos[1].valor)}` : ''

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* 1. HERO ─────────────────────────────────────────────────────── */}
            <ChartCard padding={16}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.18em', color: C_MUTED_FG,
                        }}>
                            <DollarSign size={11} strokeWidth={2.4} />
                            {`Faturamento (produto) · ${periodoLabel}`}
                        </div>
                        <div style={{
                            fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                            fontSize: 32, fontWeight: 700, color: C_FG,
                            letterSpacing: '-0.04em', lineHeight: 1, marginTop: 6,
                        }}>{fmtBRL(faturamento)}</div>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isGeral ? (
                                <span style={{ fontSize: 11, color: C_MUTED_FG, fontWeight: 600 }}>todos os tempos</span>
                            ) : emCurso ? (
                                <span style={{ fontSize: 11, color: C_MUTED_FG, fontWeight: 600 }}>mês em curso</span>
                            ) : (
                                <>
                                    <DeltaPill delta={delta} size="md" />
                                    <span style={{ fontSize: 11, color: C_MUTED_FG, fontWeight: 500 }}>
                                        vs. mês ant. ·{' '}
                                        <span style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums' }}>
                                            {fmtBRL(fatAnterior)}
                                        </span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                    <div style={{ flexShrink: 0, paddingTop: 4 }}>
                        {fat8m.length > 1 && (
                            <Sparkline animKey={`${animKey}-spark`}
                                       data={fat8m.map(m => m.valor)}
                                       width={88} height={36} color="#13ec13" />
                        )}
                        <div style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.12em', color: C_MUTED_FG,
                            marginTop: 4, textAlign: 'right',
                        }}>últimos {fat8m.length} m.</div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                    <MiniStat label="Lucro produto" value={fmtBRL(lucroEst)} accent="#0a8a0a" />
                    <MiniStat label="Margem bruta"  value={`${margemBruta.toFixed(1)}%`} />
                    <MiniStat label="Receita frete" value={fmtBRL(receitaFrete)} accent="#3B82F6" />
                </div>
            </ChartCard>

            {/* 2. EVOLUÇÃO 8 MESES ────────────────────────────────────────── */}
            {fat8m.length > 1 && (
                <section>
                    <Insight
                        eyebrow="Evolução 8 meses"
                        headline={evolHeadline}
                        sub={`Maior mês: ${maxFat.label.toUpperCase()} · ${fmtBRL(maxFat.valor)}`}
                    />
                    <ChartCard padding={14}>
                        <AreaChart
                            data={fat8m.map(m => m.valor)}
                            labels={fat8m.map(m => m.label)}
                            currentIndex={fat8m.length - 1}
                            width={324} height={150}
                            color="#13ec13"
                            animKey={`${animKey}-area`}
                        />
                    </ChartCard>
                </section>
            )}

            {/* 3. FORMAS DE PAGAMENTO ─────────────────────────────────────── */}
            {pagamentos.length > 0 && (
                <section>
                    <Insight
                        eyebrow={`Como recebemos · ${periodoLabel}`}
                        headline={topPg ? `${topPg.label} paga ${topPg.pct}% do que entra.` : 'Distribuição por forma de pagamento.'}
                        sub={pgInsightSub}
                    />
                    <ChartCard padding={16}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Donut
                                animKey={`${animKey}-pg`}
                                segments={pagamentos.map(p => ({ pct: p.pct, color: p.color }))}
                                centerLabel={topPg ? `${topPg.pct}%` : '—'}
                                centerSub={topPg?.label}
                                size={110}
                            />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {pagamentos.map(p => (
                                    <div key={p.forma ?? p.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: 2,
                                            background: p.color, flexShrink: 0,
                                        }} />
                                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: C_FG }}>{p.label}</span>
                                        <span style={{
                                            fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                                            fontSize: 11, fontWeight: 700, color: C_FG, letterSpacing: '-0.01em',
                                        }}>{fmtBRLk(p.valor)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ChartCard>
                </section>
            )}

            {/* 4. PRÓXIMOS 30 DIAS ────────────────────────────────────────── */}
            <section>
                <Insight
                    eyebrow="Próximos 30 dias"
                    headline={`${fmtBRL(totalReceber)} para entrar, ${fmtBRL(totalPagar)} para sair.`}
                    sub={`Saldo previsto: ${saldoPrevisto >= 0 ? '+' : '−'}${fmtBRL(Math.abs(saldoPrevisto))}`}
                />
                <ChartCard padding={14}>
                    <StackedTimeline
                        data={timelineData}
                        width={326} height={130}
                        animKey={`${animKey}-tl`}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                        {/* A receber */}
                        <div style={{
                            background: 'rgba(19,236,19,.06)',
                            border: '1px solid rgba(19,236,19,.20)',
                            borderRadius: 10, padding: '10px 12px',
                        }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: '#0a8a0a',
                            }}>
                                <PiggyBank size={11} strokeWidth={2.4} /> A receber
                            </div>
                            <div style={{
                                fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                                fontSize: 16, fontWeight: 700, color: C_FG,
                                letterSpacing: '-0.02em', marginTop: 3, lineHeight: 1.05,
                            }}>{fmtBRL(totalReceber)}</div>
                            <div style={{
                                fontSize: 10, fontWeight: 500, color: C_MUTED_FG, marginTop: 2,
                                fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                            }}>
                                {qtdVendas} vendas
                                {atrasados.length > 0 && (
                                    <span style={{ color: '#b91c1c', fontWeight: 700, marginLeft: 4 }}>
                                        · {atrasados.length} atrasadas
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* A pagar */}
                        <div style={{
                            background: 'rgba(239,68,68,.05)',
                            border: '1px solid rgba(239,68,68,.15)',
                            borderRadius: 10, padding: '10px 12px',
                        }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.08em', color: '#b91c1c',
                            }}>
                                <CreditCard size={11} strokeWidth={2.4} /> A pagar
                            </div>
                            <div style={{
                                fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                                fontSize: 16, fontWeight: 700, color: C_FG,
                                letterSpacing: '-0.02em', marginTop: 3, lineHeight: 1.05,
                            }}>{fmtBRL(totalPagar)}</div>
                            <div style={{
                                fontSize: 10, fontWeight: 500, color: C_MUTED_FG, marginTop: 2,
                                fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                            }}>
                                {qtdContas} contas
                                {vencidas > 0 && (
                                    <span style={{ color: '#b91c1c', fontWeight: 700, marginLeft: 4 }}>
                                        · {vencidas} vencidas
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Atrasados list */}
                    {atrasados.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: 8,
                            }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                    letterSpacing: '0.12em', color: '#b91c1c',
                                }}>
                                    <AlertTriangle size={11} strokeWidth={2.4} />
                                    {atrasados.length} {atrasados.length === 1 ? 'pagamento atrasado' : 'pagamentos atrasados'}
                                </span>
                            </div>
                            {atrasados.map((a, i) => (
                                <div key={a.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 0',
                                    borderBottom: i === atrasados.length - 1 ? 'none' : `1px solid hsl(var(--border))`,
                                }}>
                                    <span style={{
                                        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                                        background: 'rgba(239,68,68,.08)', color: '#b91c1c',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <AlertTriangle size={13} strokeWidth={2.4} />
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 12, fontWeight: 700, color: C_FG,
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        }}>{a.nome}</div>
                                        <div style={{
                                            fontSize: 10, fontWeight: 700, color: '#b91c1c',
                                            fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', marginTop: 1,
                                        }}>{a.dias}d de atraso</div>
                                    </div>
                                    <span style={{
                                        fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                                        fontSize: 13, fontWeight: 700, color: C_FG, letterSpacing: '-0.01em',
                                    }}>{fmtBRL(a.valor)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </ChartCard>
            </section>

        </div>
    )
}
