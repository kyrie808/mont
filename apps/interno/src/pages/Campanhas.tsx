import { useMemo, useState } from 'react'
import { RefreshCw, Megaphone, Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { useToast } from '../components/ui/Toast'
import { useRptCampanhasRoasMensal, useRptCampanhasPromocao } from '../hooks/useRelatorios'
import { useSincronizarCampanhasMeta } from '../hooks/useCampanhas'
import { Insight, ChartCard, EmptyState, fmtBRL, fmtNum, MES_ABBREV } from '../components/relatorios/RelatoriosUI'
import { AreaChart, C_FG, C_MUTED, C_MUTED_FG, COL_PRIMARY } from '../components/relatorios/Charts'

const colHead = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

// effective_status da Meta → badge.
function StatusBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-xs text-muted-foreground/60">—</span>
    const ativa = status === 'ACTIVE'
    const label = ativa ? 'Ativa' : status === 'PAUSED' ? 'Pausada' : status.toLowerCase()
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold"
            style={{
                borderColor: ativa ? 'rgba(19,236,19,.35)' : 'hsl(var(--border))',
                color: ativa ? '#0a8a0a' : C_MUTED_FG,
                background: ativa ? 'rgba(19,236,19,.08)' : 'transparent',
            }}
        >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: ativa ? '#0a8a0a' : C_MUTED_FG }} />
            {label}
        </span>
    )
}

type Periodo = { tipo: 'geral' } | { tipo: 'mes'; ano: number; mes: number }

const HOJE = new Date()
const ANO_ATUAL = HOJE.getFullYear()
const MES_ATUAL = HOJE.getMonth() + 1

interface CampAgg {
    campanha_id: string
    nome: string
    meta_status: string | null
    gasto: number
    receita: number
    converteram: number
    leads: number
}

export function Campanhas() {
    const toast = useToast()
    // ROAS é vitalício por natureza (gasto e a venda que ele gera caem em meses diferentes);
    // por isso a página abre em "Geral", que é a leitura verdadeira.
    const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'geral' })

    const { data: roasRows = [], isLoading } = useRptCampanhasRoasMensal()
    const { data: promocoes = [] } = useRptCampanhasPromocao()
    const sync = useSincronizarCampanhasMeta()

    const noFuturo = periodo.tipo === 'mes' && periodo.ano === ANO_ATUAL && periodo.mes === MES_ATUAL
    function stepMes(delta: number) {
        if (periodo.tipo !== 'mes') return
        if (delta > 0 && noFuturo) return
        const d = new Date(periodo.ano, periodo.mes - 1 + delta, 1)
        setPeriodo({ tipo: 'mes', ano: d.getFullYear(), mes: d.getMonth() + 1 })
    }

    const { trafego, totGasto, totReceita, trend, trendLabels, trendCurrent } = useMemo(() => {
        const inScope = (r: typeof roasRows[number]) =>
            periodo.tipo === 'geral' || (r.ano === periodo.ano && r.mes === periodo.mes)

        // Agrega por campanha no período selecionado.
        const byCamp = new Map<string, CampAgg>()
        for (const r of roasRows.filter(inScope)) {
            const id = r.campanha_id ?? ''
            const acc = byCamp.get(id) ?? {
                campanha_id: id, nome: r.nome ?? '—', meta_status: r.meta_status ?? null,
                gasto: 0, receita: 0, converteram: 0, leads: 0,
            }
            acc.gasto += Number(r.gasto ?? 0)
            acc.receita += Number(r.receita ?? 0)
            acc.converteram += Number(r.converteram ?? 0)
            acc.leads += Number(r.leads ?? 0)
            byCamp.set(id, acc)
        }
        const trafego = [...byCamp.values()].sort((a, b) => b.gasto - a.gasto)
        const totGasto = trafego.reduce((s, c) => s + c.gasto, 0)
        const totReceita = trafego.reduce((s, c) => s + c.receita, 0)

        // Tendência de gasto: agregada por mês (todos os meses, vitalício).
        const mesMap = new Map<string, { ano: number; mes: number; gasto: number }>()
        for (const r of roasRows) {
            if (r.ano == null || r.mes == null) continue
            const k = `${r.ano}-${String(r.mes).padStart(2, '0')}`
            const acc = mesMap.get(k) ?? { ano: r.ano, mes: r.mes, gasto: 0 }
            acc.gasto += Number(r.gasto ?? 0)
            mesMap.set(k, acc)
        }
        const serie = [...mesMap.values()].sort((a, b) => a.ano - b.ano || a.mes - b.mes).slice(-12)
        const trend = serie.map(s => s.gasto)
        const trendLabels = serie.map(s => MES_ABBREV[s.mes - 1] ?? '')
        const trendCurrent = periodo.tipo === 'mes'
            ? serie.findIndex(s => s.ano === periodo.ano && s.mes === periodo.mes)
            : -1

        return { trafego, totGasto, totReceita, trend, trendLabels, trendCurrent }
    }, [roasRows, periodo])

    const roasGeral = totGasto > 0 && totReceita > 0 ? totReceita / totGasto : null
    const isMes = periodo.tipo === 'mes'

    const handleSync = async () => {
        try {
            const r = await sync.mutateAsync()
            toast.success(`Sincronizado: ${fmtNum(r.upserts ?? 0)} campanha(s) · ${fmtNum(r.metricas ?? 0)} dia(s) de gasto.`)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Falha ao sincronizar com a Meta')
        }
    }

    const pill: React.CSSProperties = {
        padding: '5px 12px', borderRadius: 999, border: 'none',
        fontFamily: 'Lexend', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer',
    }
    const stepBtn: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 999, border: 'none', background: C_MUTED, color: C_FG, cursor: 'pointer',
    }

    return (
        <>
            <Header title="Campanhas" showBack />
            <PageContainer className="pt-0 pb-24 bg-transparent">

                {/* Período: Geral (leitura verdadeira do ROAS) / Mês (gasto no tempo) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', flexWrap: 'wrap' }}>
                    <button onClick={() => setPeriodo({ tipo: 'geral' })}
                        style={{ ...pill, background: periodo.tipo === 'geral' ? C_FG : C_MUTED, color: periodo.tipo === 'geral' ? 'hsl(var(--background))' : C_MUTED_FG }}>
                        Geral
                    </button>
                    <button onClick={() => setPeriodo({ tipo: 'mes', ano: ANO_ATUAL, mes: MES_ATUAL })}
                        style={{ ...pill, background: isMes ? C_FG : C_MUTED, color: isMes ? 'hsl(var(--background))' : C_MUTED_FG }}>
                        Mês
                    </button>
                    {isMes && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
                            <button style={stepBtn} onClick={() => stepMes(-1)} aria-label="Mês anterior"><ChevronLeft size={15} strokeWidth={2.4} /></button>
                            <span style={{ minWidth: 78, textAlign: 'center', fontFamily: 'Lexend', fontSize: 12, fontWeight: 800, color: C_FG, textTransform: 'capitalize' }}>
                                {MES_ABBREV[periodo.mes - 1]}/{periodo.ano}
                            </span>
                            <button style={{ ...stepBtn, opacity: noFuturo ? 0.4 : 1, cursor: noFuturo ? 'not-allowed' : 'pointer' }} onClick={() => stepMes(1)} aria-label="Próximo mês"><ChevronRight size={15} strokeWidth={2.4} /></button>
                        </div>
                    )}
                </div>

                <div className="grid gap-[18px] pt-1 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8">

                    {/* TRÁFEGO (META) — ROAS ─────────────────────────────────── */}
                    <section className="lg:col-span-12">
                        <div className="mb-2.5 flex items-end justify-between gap-3 pl-1">
                            <Insight
                                eyebrow={`Tráfego (Meta)${isMes ? ` · ${MES_ABBREV[periodo.mes - 1]}/${periodo.ano}` : ' · geral'}`}
                                headline={
                                    totGasto > 0
                                        ? (roasGeral != null
                                            ? `ROAS ${roasGeral.toFixed(2)}x — ${fmtBRL(totReceita)} de receita pra ${fmtBRL(totGasto)} de anúncio.`
                                            : `${fmtBRL(totGasto)} investidos, receita atribuída ainda não apareceu.`)
                                        : 'Sem gasto de anúncio no período.'
                                }
                                sub="Gasto real da Meta × receita que o sistema atribui à campanha. Atribuição manual: cresce conforme você marca a origem no cadastro."
                            />
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={sync.isPending}
                                className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />
                                {sync.isPending ? 'Sincronizando…' : 'Sincronizar agora'}
                            </button>
                        </div>
                        <ChartCard padding={0}>
                            {isLoading ? (
                                <EmptyState msg="Carregando campanhas…" />
                            ) : trafego.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    <Radio size={20} style={{ opacity: 0.4, marginBottom: 6, display: 'inline-block' }} /><br />
                                    {roasRows.length === 0
                                        ? 'Clique em “Sincronizar agora” pra puxar as campanhas da Meta.'
                                        : 'Nenhuma campanha com movimento nesse mês.'}
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                                        <span className={colHead} style={{ flex: 1 }}>Campanha</span>
                                        <span className={colHead} style={{ width: 78, textAlign: 'right' }}>Status</span>
                                        <span className={colHead} style={{ width: 72, textAlign: 'right' }}>Gasto</span>
                                        <span className={colHead} style={{ width: 48, textAlign: 'right' }}>Leads</span>
                                        <span className={colHead} style={{ width: 78, textAlign: 'right' }}>Receita</span>
                                        <span className={colHead} style={{ width: 52, textAlign: 'right' }}>ROAS</span>
                                        <span className={colHead} style={{ width: 66, textAlign: 'right' }}>CAC</span>
                                    </div>
                                    {trafego.map((c, i) => {
                                        const roas = c.gasto > 0 && c.receita > 0 ? c.receita / c.gasto : null
                                        const cac = c.converteram > 0 ? c.gasto / c.converteram : null
                                        return (
                                            <div key={c.campanha_id || i} style={{
                                                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                                                borderBottom: i === trafego.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                            }}>
                                                <span className="text-sm font-bold text-foreground" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                                                <span style={{ width: 78, textAlign: 'right' }}><StatusBadge status={c.meta_status} /></span>
                                                <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 72, textAlign: 'right' }}>{fmtBRL(c.gasto)}</span>
                                                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" style={{ width: 48, textAlign: 'right' }}>{fmtNum(c.leads)}</span>
                                                <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 78, textAlign: 'right' }}>{fmtBRL(c.receita)}</span>
                                                <span className="font-mono text-sm font-bold tabular-nums" style={{ width: 52, textAlign: 'right', color: roas == null ? C_MUTED_FG : roas >= 1 ? '#0a8a0a' : '#b91c1c' }}>
                                                    {roas == null ? '—' : `${roas.toFixed(1)}x`}
                                                </span>
                                                <span className="font-mono text-sm tabular-nums" style={{ width: 66, textAlign: 'right', color: cac == null ? C_MUTED_FG : 'inherit' }}>
                                                    {cac == null ? '—' : fmtBRL(cac)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    <div style={{ padding: '9px 14px', borderTop: '1px solid hsl(var(--border))' }}>
                                        <span className="text-xs text-muted-foreground">ROAS = receita ÷ gasto (só quando os dois existem no período). No “Mês”, gasto e venda podem cair em meses diferentes — o “Geral” é a leitura completa.</span>
                                    </div>
                                </>
                            )}
                        </ChartCard>
                    </section>

                    {/* TENDÊNCIA DE GASTO ─────────────────────────────────────── */}
                    {trend.some(v => v > 0) && (
                        <section className="lg:col-span-12">
                            <Insight eyebrow="Investimento no tempo" headline="Quanto foi pra anúncio, mês a mês." />
                            <ChartCard padding={16}>
                                <AreaChart
                                    data={trend}
                                    labels={trendLabels}
                                    currentIndex={trendCurrent >= 0 ? trendCurrent : undefined}
                                    animKey={`camp-trend-${periodo.tipo === 'mes' ? `${periodo.ano}-${periodo.mes}` : 'geral'}`}
                                    height={150}
                                    fmtAxis={(v) => fmtBRL(v)}
                                    fmtValue={(v) => fmtBRL(v)}
                                />
                            </ChartCard>
                        </section>
                    )}

                    {/* PROMOÇÕES (INTERNAS) ───────────────────────────────────── */}
                    <section className="lg:col-span-12">
                        <Insight
                            eyebrow="Promoções (internas)"
                            headline={promocoes.length > 0 ? `${fmtNum(promocoes.length)} ${promocoes.length === 1 ? 'oferta' : 'ofertas'} a clientes.` : 'Nenhuma oferta ainda.'}
                            sub="Ofertas que você empurra pros clientes no kanban — não são anúncios, ficam só aqui dentro."
                        />
                        <ChartCard padding={0}>
                            {promocoes.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    <Megaphone size={20} style={{ opacity: 0.4, marginBottom: 6, display: 'inline-block' }} /><br />
                                    Ofereça uma campanha no kanban (Registrar contato → Campanha/oferta).
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                                        <span className={colHead} style={{ flex: 1 }}>Campanha</span>
                                        <span className={colHead} style={{ width: 84, textAlign: 'right' }}>Participaram</span>
                                        <span className={colHead} style={{ width: 74, textAlign: 'right' }}>Compraram</span>
                                        <span className={colHead} style={{ width: 74, textAlign: 'right' }}>Receita</span>
                                    </div>
                                    {promocoes.map((c, i) => (
                                        <div key={c.campanha_id ?? i} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                                            borderBottom: i === promocoes.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                        }}>
                                            <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: 999, background: c.ativo ? COL_PRIMARY : C_MUTED_FG }} />
                                            <span className="text-sm font-bold text-foreground" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                                            <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" style={{ width: 84, textAlign: 'right' }}>{fmtNum(c.participantes ?? 0)}</span>
                                            <span className="font-mono text-sm font-bold tabular-nums" style={{ width: 74, textAlign: 'right', color: (c.compraram ?? 0) > 0 ? '#0a8a0a' : C_MUTED_FG }}>{fmtNum(c.compraram ?? 0)}</span>
                                            <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 74, textAlign: 'right' }}>{fmtBRL(Number(c.receita_gerada ?? 0))}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </ChartCard>
                    </section>

                </div>
            </PageContainer>
        </>
    )
}
