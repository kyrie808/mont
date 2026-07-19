import { useMemo, useState } from 'react'
import { isMesEmCurso } from '../../utils/calculations'
import { AlertTriangle, DollarSign, ChevronDown, ChevronRight, CalendarOff } from 'lucide-react'
import {
    useRptFaturamentoComparativo,
    useRptDistribuicaoFormaPagamento,
    useRptProjecaoRecebimentos,
    useRptProjecaoPagamentos,
} from '../../hooks/useRelatorios'
import {
    Sparkline, AreaChart, Donut,
    C_MUTED_FG, C_FG, C_MONO, COL_PRIMARY, COL_DESTRUCT, COL_WARNING,
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
    const [verTodosAtraso, setVerTodosAtraso] = useState(false)

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

    const receberInfo = useMemo(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const open = recebimentos.filter(r => (r.saldo_aberto ?? 0) > 0)
        const openPagar = contasPagar.filter(p => (p.saldo_devedor ?? 0) > 0)
        const sum = (rows: typeof open) => rows.reduce((s, r) => s + (r.saldo_aberto ?? 0), 0)

        const vencidos = open.filter(r => r.situacao === 'vencido')
        const semData  = open.filter(r => r.situacao === 'sem_data')
        const aVencer  = open.filter(r => ['vence_hoje', 'proximos_7_dias', 'proximos_30_dias'].includes(r.situacao ?? ''))
        const futuro   = open.filter(r => r.situacao === 'futuro')

        const totalReceber = sum(open)
        const totalPagar   = openPagar.reduce((s, p) => s + (p.saldo_devedor ?? 0), 0)

        const buckets = [
            { id: 'vencido',  label: 'Vencido',  qtd: vencidos.length, valor: sum(vencidos), color: COL_DESTRUCT, alerta: true },
            { id: 'sem_data', label: 'Sem data', qtd: semData.length,  valor: sum(semData),  color: COL_WARNING,  alerta: true },
            { id: 'a_vencer', label: 'A vencer',  qtd: aVencer.length,  valor: sum(aVencer),  color: COL_PRIMARY,  alerta: false },
            { id: 'futuro',   label: 'Futuro',    qtd: futuro.length,   valor: sum(futuro),   color: C_MUTED_FG,   alerta: false },
        ]

        const atrasadosLista = vencidos
            .map(r => ({
                id: r.venda_id ?? Math.random().toString(),
                nome: r.contato_nome ?? '—',
                dias: r.data_prevista_pagamento
                    ? Math.floor((today.getTime() - new Date(r.data_prevista_pagamento).getTime()) / 86400000) : 0,
                valor: r.saldo_aberto ?? 0,
            }))
            .sort((a, b) => b.dias - a.dias)

        return {
            totalReceber, totalPagar, qtdVendas: open.length,
            buckets, atrasadosLista,
            semDataQtd: semData.length, semDataValor: sum(semData),
            qtdContas: openPagar.length,
            vencidasPagar: openPagar.filter(p => (p.dias_atraso ?? 0) > 0).length,
            saldoPrevisto: Math.round(sum(open)) - Math.round(totalPagar),
        }
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
        <div className="grid gap-[18px] lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8 lg:items-start">

            {/* 1. HERO ─────────────────────────────────────────────────────── */}
            <ChartCard padding={16} className="lg:col-span-12">
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
                <section className="lg:col-span-8">
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
                <section className="lg:col-span-4">
                    <Insight
                        eyebrow={`Como recebemos · ${periodoLabel}`}
                        headline={topPg ? `${topPg.label} paga ${topPg.pct}% do que entra.` : 'Distribuição por forma de pagamento.'}
                        sub={pgInsightSub}
                    />
                    <ChartCard padding={16}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <Donut
                                animKey={`${animKey}-pg`}
                                segments={pagamentos.map(p => ({ pct: p.pct, color: p.color, label: p.label, value: p.valor }))}
                                centerLabel={topPg ? `${topPg.pct}%` : '—'}
                                centerSub={topPg?.label}
                                size={120}
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

            {/* 4. A RECEBER (fiado) — por urgência ─────────────────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="A receber · fiado"
                    headline={`${fmtBRL(receberInfo.totalReceber)} a receber em ${receberInfo.qtdVendas} vendas.`}
                    sub={`A pagar: ${fmtBRL(receberInfo.totalPagar)}${receberInfo.qtdContas > 0 ? ` · ${receberInfo.qtdContas} contas` : ''}${receberInfo.vencidasPagar > 0 ? ` · ${receberInfo.vencidasPagar} vencidas` : ''}`}
                />
                <ChartCard padding={14}>
                    {/* Buckets de urgência */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {receberInfo.buckets.map(b => (
                            <div key={b.id} style={{
                                borderRadius: 10, padding: '10px 12px',
                                background: 'hsl(var(--muted) / 0.35)',
                                border: '1px solid hsl(var(--border))',
                                borderLeft: `3px solid ${b.color}`,
                            }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: b.color }}>
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: b.color }} /> {b.label}
                                </div>
                                <div style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, color: C_FG, letterSpacing: '-0.02em', marginTop: 4, lineHeight: 1 }}>{fmtBRL(b.valor)}</div>
                                <div style={{ fontSize: 10, fontWeight: 500, color: C_MUTED_FG, marginTop: 2 }}>{b.qtd} {b.qtd === 1 ? 'venda' : 'vendas'}</div>
                            </div>
                        ))}
                    </div>

                    {/* Sem data — o dinheiro esquecido */}
                    {receberInfo.semDataQtd > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'hsl(var(--warning-strong) / 0.08)', border: '1px solid hsl(var(--warning-strong) / 0.3)' }}>
                            <CalendarOff size={16} strokeWidth={2.2} style={{ color: COL_WARNING, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C_FG, fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(receberInfo.semDataValor)} sem data de cobrança</div>
                                <div style={{ fontSize: 11, color: C_MUTED_FG, fontWeight: 500 }}>{receberInfo.semDataQtd} fiados sem previsão — defina uma data pra não esquecer de cobrar.</div>
                            </div>
                        </div>
                    )}

                    {/* Lista de atrasados (contagem REAL, expansível) */}
                    {receberInfo.atrasadosLista.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: COL_DESTRUCT, marginBottom: 8 }}>
                                <AlertTriangle size={11} strokeWidth={2.4} />
                                {receberInfo.atrasadosLista.length} {receberInfo.atrasadosLista.length === 1 ? 'pagamento atrasado' : 'pagamentos atrasados'}
                            </div>
                            {(verTodosAtraso ? receberInfo.atrasadosLista : receberInfo.atrasadosLista.slice(0, 6)).map((a, i, arr) => (
                                <div key={a.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                                    borderBottom: i === arr.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                }}>
                                    <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: 'hsl(var(--destructive) / 0.1)', color: COL_DESTRUCT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <AlertTriangle size={13} strokeWidth={2.4} />
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: C_FG, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nome}</div>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: COL_DESTRUCT, fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{a.dias}d de atraso</div>
                                    </div>
                                    <span style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: C_FG, letterSpacing: '-0.01em' }}>{fmtBRL(a.valor)}</span>
                                </div>
                            ))}
                            {receberInfo.atrasadosLista.length > 6 && (
                                <button
                                    type="button"
                                    onClick={() => setVerTodosAtraso(v => !v)}
                                    style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Lexend', fontSize: 11, fontWeight: 700, color: C_MUTED_FG }}
                                >
                                    {verTodosAtraso ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {verTodosAtraso ? 'Ver menos' : `Ver todos (${receberInfo.atrasadosLista.length})`}
                                </button>
                            )}
                        </div>
                    )}
                </ChartCard>
            </section>

        </div>
    )
}
