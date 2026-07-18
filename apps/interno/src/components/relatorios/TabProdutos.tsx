import { useMemo } from 'react'
import { Award, AlertTriangle } from 'lucide-react'
import { useRptMargemPorSku, useRptGiroEstoque, useRptLtvPorCliente } from '../../hooks/useRelatorios'
import type { PeriodoRel } from '../../services/relatorioService'
import {
    C_FG, C_MUTED_FG, C_MUTED, C_MONO, COL_PRIMARY, COL_WARNING,
    useAnim,
} from './Charts'
import {
    fmtBRL, fmtBRLk, fmtNum,
    Insight, ChartCard, MiniStat, SectionEyebrow, EmptyState,
} from './RelatoriosUI'

interface Props { animKey: string | number; periodo: PeriodoRel }

// Contrato REAL da view/RPC de giro: status_estoque ∈ {zerado, abaixo_minimo, ok}.
// (Antes o código esperava alto/medio/baixo/parado — não casava, seção ficava zerada.)
type StatusEstoque = 'zerado' | 'abaixo_minimo' | 'ok'
const STOCK_META: Record<StatusEstoque, { label: string; color: string }> = {
    zerado:        { label: 'zerado',       color: '#ef4444' },
    abaixo_minimo: { label: 'abaixo mín.',  color: '#E5A50A' },
    ok:            { label: 'ok',           color: '#13ec13' },
}
const stockColor = (s: string): string => STOCK_META[s as StatusEstoque]?.color ?? C_MUTED

export function TabProdutos({ animKey, periodo }: Props) {
    const { data: margens = [], isLoading: l1, isError: e1 } = useRptMargemPorSku(periodo)
    const { data: giros = [],   isLoading: l2, isError: e2 } = useRptGiroEstoque(periodo)
    const { data: ltvRows = [] }                              = useRptLtvPorCliente(periodo)

    const isLoading = l1 || l2
    const isError   = e1 || e2

    const produtos = useMemo(() => {
        const giroMap = new Map(giros.map(g => [g.produto_id, g]))
        return margens.map(m => {
            const g = giroMap.get(m.produto_id ?? '')
            return {
                id:         m.produto_id,
                nome:       m.nome ?? '—',
                margem:     m.margem_pct ?? 0,
                receita:    m.receita_total ?? 0,
                qtd:        m.total_vendido ?? 0,
                estoque:    g?.estoque_atual ?? 0,
                estoqueMin: g?.estoque_minimo ?? 0,
                status:     (g?.status_estoque ?? 'ok') as StatusEstoque,
            }
        })
    }, [margens, giros])

    const derived = useMemo(() => {
        if (!produtos.length && !giros.length) return null

        const margemMedia   = produtos.length ? Math.round(produtos.reduce((s, p) => s + p.margem, 0) / produtos.length) : 0
        const totalReceita  = produtos.reduce((s, p) => s + p.receita, 0)

        // Curva ABC (por receita acumulada): A = até 80%, B = até 95%, C = resto.
        // O produto que CRUZA o limiar entra na faixa onde começou (convenção usual).
        const byReceita = [...produtos].filter(p => p.receita > 0).sort((a, b) => b.receita - a.receita)
        let acum = 0
        const abc = byReceita.map(p => {
            const antesPct = totalReceita > 0 ? acum / totalReceita * 100 : 0
            acum += p.receita
            const classe: 'A' | 'B' | 'C' = antesPct < 80 ? 'A' : antesPct < 95 ? 'B' : 'C'
            return { id: p.id, nome: p.nome, receita: p.receita, margem: p.margem, pctAcum: totalReceita > 0 ? Math.round(acum / totalReceita * 100) : 0, classe }
        })
        const abcResumo = (['A', 'B', 'C'] as const).map(cl => {
            const g = abc.filter(a => a.classe === cl)
            const receita = g.reduce((s, a) => s + a.receita, 0)
            return { classe: cl, qtd: g.length, receita, pct: totalReceita > 0 ? Math.round(receita / totalReceita * 100) : 0 }
        })

        // Saúde do estoque vem de `giros` (TODOS os produtos ativos, snapshot atual de estoque),
        // não de `produtos` (só os que venderam no período) — senão um zerado que não vendeu somia.
        const statusCount = giros.reduce((acc, g) => {
            const s = (g.status_estoque ?? 'ok') as StatusEstoque
            acc[s] = (acc[s] ?? 0) + 1
            return acc
        }, {} as Record<StatusEstoque, number>)
        const zerados   = statusCount.zerado ?? 0
        const abaixoMin = statusCount.abaixo_minimo ?? 0
        // "Precisam de atenção" = zerado + abaixo do mínimo (zerado primeiro).
        const precisamAtencao = giros
            .filter(g => g.status_estoque === 'zerado' || g.status_estoque === 'abaixo_minimo')
            .map(g => ({
                id:         g.produto_id,
                nome:       g.nome ?? '—',
                status:     (g.status_estoque ?? 'ok') as StatusEstoque,
                estoque:    g.estoque_atual ?? 0,
                estoqueMin: g.estoque_minimo ?? 0,
                qtd:        g.total_vendido_historico ?? 0,
            }))
            .sort((a, b) => (a.status === 'zerado' ? 0 : 1) - (b.status === 'zerado' ? 0 : 1))

        const topProduct = margens[0]

        // outros = receita de vendas sem itens (LTV-produto − receita itemizada). Ambos produto.
        const totalLtv      = ltvRows.reduce((s, c) => s + (c.ltv_total ?? 0), 0)
        const outrosReceita = Math.round(totalLtv) - Math.round(totalReceita)

        return {
            margemMedia, zerados, abaixoMin, totalReceita,
            abc, abcResumo,
            statusCount, precisamAtencao, totalProdutos: giros.length, topProduct, outrosReceita,
        }
    }, [produtos, giros, margens, ltvRows])

    if (isLoading) return <EmptyState msg="Carregando dados de produtos…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados de produtos." />
    if (!derived)  return <EmptyState msg="Sem dados de produtos disponíveis." />

    const {
        margemMedia, zerados, abaixoMin,
        abc, abcResumo,
        statusCount, precisamAtencao, totalProdutos, topProduct, outrosReceita,
    } = derived
    const classeA = abcResumo.find(r => r.classe === 'A')
    const classeColor = (cl: 'A' | 'B' | 'C') => cl === 'A' ? COL_PRIMARY : cl === 'B' ? COL_WARNING : C_MUTED_FG

    return (
        <div className="grid gap-[18px] lg:grid-cols-12 lg:gap-4 lg:items-start">

            {/* 1. HERO ─────────────────────────────────────────────────────── */}
            <ChartCard padding={14} className="lg:col-span-12">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                        flexShrink: 0, width: 42, height: 42, borderRadius: 12,
                        background: 'rgba(19,236,19,.10)', color: '#0a8a0a',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Award size={22} strokeWidth={2.2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.18em', color: C_MUTED_FG,
                        }}>Produto + lucrativo</div>
                        <div style={{
                            marginTop: 2, fontSize: 15, fontWeight: 800, color: C_FG,
                            letterSpacing: '-0.01em', lineHeight: 1.2,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{topProduct?.nome ?? '—'}</div>
                    </div>
                    <div style={{
                        fontFamily: C_MONO, fontSize: 14, fontWeight: 700,
                        color: '#0a8a0a', padding: '4px 10px', borderRadius: 999,
                        background: 'rgba(19,236,19,.10)',
                        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
                        flexShrink: 0,
                    }}>{fmtBRLk(topProduct?.lucro_bruto ?? 0)} lucro · {(topProduct?.margem_pct ?? 0).toFixed(0)}% mg.</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
                    <MiniStat label="Margem média" value={`${margemMedia}%`} />
                    <MiniStat label="Abaixo mín."  value={fmtNum(abaixoMin)}
                              accent={abaixoMin > 0 ? '#c2410c' : undefined} />
                    <MiniStat label="Zerados"      value={fmtNum(zerados)}
                              accent={zerados > 0 ? '#b91c1c' : undefined} />
                </div>
            </ChartCard>

            {/* 2. CURVA ABC ─────────────────────────────────────────────────── */}
            {abc.length > 0 && (
                <section className="lg:col-span-7">
                    <Insight
                        eyebrow="Curva ABC · vencedores"
                        headline={`${fmtNum(classeA?.qtd ?? 0)} produtos (classe A) geram ${classeA?.pct ?? 0}% da receita.`}
                        sub="A = até 80% do faturamento · B = até 95% · C = a cauda."
                    />
                    <ChartCard padding={14}>
                        {/* resumo A/B/C */}
                        <div className="grid grid-cols-3 gap-2">
                            {abcResumo.map(r => (
                                <div key={r.classe} style={{ borderRadius: 10, padding: '9px 11px', background: 'hsl(var(--muted) / 0.35)', border: '1px solid hsl(var(--border))', borderLeft: `3px solid ${classeColor(r.classe)}` }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: classeColor(r.classe) }}>
                                        <span style={{ width: 7, height: 7, borderRadius: 999, background: classeColor(r.classe) }} /> Classe {r.classe}
                                    </div>
                                    <div style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, color: C_FG, marginTop: 4, lineHeight: 1 }}>{r.pct}%</div>
                                    <div style={{ fontSize: 10, color: C_MUTED_FG, fontWeight: 500, marginTop: 2 }}>{fmtNum(r.qtd)} {r.qtd === 1 ? 'produto' : 'produtos'}</div>
                                </div>
                            ))}
                        </div>

                        {/* lista por produto: classe + nome + margem + receita */}
                        <div style={{ marginTop: 12 }}>
                            {abc.map((p, i) => (
                                <div key={p.id ?? i} style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                                    borderBottom: i === abc.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                }}>
                                    <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: `color-mix(in srgb, ${classeColor(p.classe)} 16%, transparent)`, color: classeColor(p.classe), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, fontFamily: 'Lexend' }}>{p.classe}</span>
                                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: C_FG, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
                                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: C_MUTED_FG, fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', width: 52, textAlign: 'right' }}>{p.margem.toFixed(0)}% mg</span>
                                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: C_FG, fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', width: 64, textAlign: 'right' }}>{fmtBRLk(p.receita)}</span>
                                </div>
                            ))}
                            {outrosReceita > 0 && (
                                <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: C_MUTED_FG }}>Outros · vendas sem itens</span>
                                    <span style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 700, color: C_MUTED_FG }}>{fmtBRL(outrosReceita)}</span>
                                </div>
                            )}
                        </div>
                    </ChartCard>
                </section>
            )}

            {/* 3. SAÚDE DO ESTOQUE ─────────────────────────────────────────── */}
            <section className="lg:col-span-5">
                <Insight
                    eyebrow="Saúde do estoque"
                    headline={`${precisamAtencao.length} SKUs precisam de atenção.`}
                    sub={`${statusCount.zerado ?? 0} zerados · ${statusCount.abaixo_minimo ?? 0} abaixo do mínimo · ${statusCount.ok ?? 0} ok`}
                />
                <ChartCard padding={14}>
                    <StockBar
                        key={`${animKey}-sb`}
                        counts={[
                            { id: 'zerado',        label: 'zerado',      n: statusCount.zerado        ?? 0, color: STOCK_META.zerado.color },
                            { id: 'abaixo_minimo', label: 'abaixo mín.', n: statusCount.abaixo_minimo ?? 0, color: STOCK_META.abaixo_minimo.color },
                            { id: 'ok',            label: 'ok',          n: statusCount.ok            ?? 0, color: STOCK_META.ok.color },
                        ]}
                        total={totalProdutos}
                        animKey={`${animKey}-sb`}
                    />

                    {precisamAtencao.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                            <SectionEyebrow icon={<AlertTriangle size={11} strokeWidth={2.4} style={{ color: '#b91c1c' }} />}>
                                <span style={{ color: '#b91c1c' }}>Atenção</span>
                            </SectionEyebrow>
                            {precisamAtencao.map((p, i) => (
                                <StockRow
                                    key={p.id ?? i}
                                    nome={p.nome}
                                    status={STOCK_META[p.status].label}
                                    estoque={p.estoque}
                                    estoqueMin={p.estoqueMin}
                                    qtd={p.qtd}
                                    color={stockColor(p.status)}
                                    last={i === precisamAtencao.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </ChartCard>
            </section>

        </div>
    )
}

// ── StockBar ──────────────────────────────────────────────────────────────────
interface StockBarItem {
    id: string
    label: string
    n: number
    color: string
}
interface StockBarProps {
    counts: StockBarItem[]
    total: number
    animKey: string | number
}

function StockBar({ counts, total, animKey }: StockBarProps) {
    const t = useAnim([animKey])
    return (
        <div>
            <div style={{
                display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden',
                background: C_MUTED, marginBottom: 8,
            }}>
                {counts.map(c => (
                    <div key={c.id} style={{
                        width: `${total > 0 ? (c.n / total) * 100 * t : 0}%`,
                        background: c.color,
                        transition: 'width 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
                    }} />
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                {counts.map(c => (
                    <div key={c.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, fontWeight: 600, color: C_MUTED_FG,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: c.color }} />
                            {c.label}
                        </span>
                        <span style={{
                            fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                            fontSize: 14, fontWeight: 700, color: C_FG, letterSpacing: '-0.02em',
                        }}>{c.n}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── StockRow ──────────────────────────────────────────────────────────────────
interface StockRowProps {
    nome: string
    status: string
    estoque: number
    estoqueMin: number
    qtd: number
    color: string
    last: boolean
}

function StockRow({ nome, status, estoque, estoqueMin, qtd, color, last }: StockRowProps) {
    const stockLow = estoque < estoqueMin
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 0',
            borderBottom: last ? 'none' : `1px solid hsl(var(--border))`,
            minHeight: 50,
        }}>
            <span style={{ flexShrink: 0, width: 4, height: 28, borderRadius: 999, background: color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12, fontWeight: 700, color: C_FG,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{nome}</div>
                <div style={{
                    marginTop: 2, fontSize: 10, color: C_MUTED_FG, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 7,
                }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                        color: stockLow ? '#c2410c' : C_FG, fontWeight: 700,
                    }}>
                        {stockLow && <AlertTriangle size={10} strokeWidth={2.4} />}
                        {estoque}<span style={{ color: C_MUTED_FG, fontWeight: 500 }}>/{estoqueMin}</span>
                    </span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums' }}>{qtd} un vend.</span>
                </div>
            </div>
            <span style={{
                display: 'inline-flex', alignItems: 'center',
                height: 18, padding: '0 7px', borderRadius: 999,
                background: `${color}1a`, color,
                fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
                textTransform: 'uppercase', fontFamily: 'Lexend',
                flexShrink: 0,
            }}>{status}</span>
        </div>
    )
}
