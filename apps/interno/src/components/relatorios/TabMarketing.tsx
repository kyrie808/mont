import { useMemo } from 'react'
import { useRptMarketingPedidos } from '../../hooks/useRelatorios'
import type { PeriodoRel } from '../../services/relatorioService'
import {
    Donut, StackedArea,
    C_FG, C_MUTED_FG, C_MUTED, C_MONO,
    useAnim,
} from './Charts'
import {
    fmtBRL, fmtNum,
    Insight, ChartCard, MiniStat, LegendDot, EmptyState,
} from './RelatoriosUI'

interface Props { animKey: string | number; periodo: PeriodoRel }

export function TabMarketing({ animKey, periodo }: Props) {
    const { data: rows = [], isLoading, isError } = useRptMarketingPedidos(periodo)

    const derived = useMemo(() => {
        if (!rows.length) return null

        const totalOnline  = rows.reduce((s, r) => s + (r.faturamento_online  ?? 0), 0)
        const totalDireto  = rows.reduce((s, r) => s + (r.faturamento_direto  ?? 0), 0)
        const totalFat     = totalOnline + totalDireto

        const totalPedOnline = rows.reduce((s, r) => s + (r.pedidos_online  ?? 0), 0)
        const totalPedDireto = rows.reduce((s, r) => s + (r.pedidos_diretos ?? 0), 0)
        const totalPedidos   = totalPedOnline + totalPedDireto

        const totalEntregas  = rows.reduce((s, r) => s + (r.entregas_count  ?? 0), 0)
        const totalRetiradas = rows.reduce((s, r) => s + (r.retiradas_count ?? 0), 0)

        const onlinePct = totalFat > 0 ? Math.round(totalOnline / totalFat * 100) : 0
        const diretoPct = 100 - onlinePct

        const ticketOnline = totalPedOnline > 0 ? totalOnline / totalPedOnline : 0
        const ticketDireto = totalPedDireto > 0 ? totalDireto / totalPedDireto : 0

        const sorted = [...rows].sort((a, b) =>
            (a.semana_iso ?? '').localeCompare(b.semana_iso ?? ''))
        const last8  = sorted.slice(-8)
        const weeks  = last8.map(r => ({
            sem:    (r.semana_iso ?? '').replace(/^\d{4}-/, ''),
            online: r.pedidos_online  ?? 0,
            direto: r.pedidos_diretos ?? 0,
        }))

        const onlineGrowth = weeks.length >= 2 && weeks[0].online > 0
            ? Math.round(((weeks[weeks.length - 1].online - weeks[0].online) / weeks[0].online) * 100)
            : 0

        return {
            totalOnline, totalDireto,
            totalPedOnline, totalPedDireto, totalPedidos,
            totalEntregas, totalRetiradas,
            onlinePct, diretoPct, ticketOnline, ticketDireto,
            weeks, onlineGrowth,
        }
    }, [rows])

    if (isLoading) return <EmptyState msg="Carregando dados de marketing…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados de marketing." />
    if (!derived)  return <EmptyState msg="Sem dados de marketing disponíveis." />

    const {
        totalOnline, totalDireto,
        totalPedOnline, totalPedDireto, totalPedidos,
        totalEntregas, totalRetiradas,
        onlinePct, diretoPct, ticketOnline, ticketDireto,
        weeks, onlineGrowth,
    } = derived

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* 1. KPI GRID ─────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <MiniStat label="Pedidos"   value={fmtNum(totalPedidos)} />
                <MiniStat label="Entregas"  value={fmtNum(totalEntregas)} />
                <MiniStat label="Retiradas" value={fmtNum(totalRetiradas)} />
            </div>

            {/* 2. ORIGEM DAS VENDAS ────────────────────────────────────────── */}
            <section>
                <Insight
                    eyebrow="Origem · Canal"
                    headline={`Online representa ${onlinePct}% do faturamento.`}
                    sub={`${fmtBRL(totalOnline)} online · ${fmtBRL(totalDireto)} direto`}
                />
                <ChartCard padding={16}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <Donut
                            animKey={`${animKey}-mk-d`}
                            segments={[
                                { pct: onlinePct, color: '#13ec13' },
                                { pct: diretoPct, color: '#10b981' },
                            ]}
                            centerLabel={`${onlinePct}%`}
                            centerSub="online"
                            size={106}
                        />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <ChannelRow color="#13ec13" label="Online"
                                        pct={onlinePct} fat={totalOnline} ped={totalPedOnline} />
                            <ChannelRow color="#10b981" label="Direto"
                                        pct={diretoPct} fat={totalDireto} ped={totalPedDireto} />
                        </div>
                    </div>
                </ChartCard>
            </section>

            {/* 3. EVOLUÇÃO SEMANAL ─────────────────────────────────────────── */}
            {weeks.length >= 2 && (
                <section>
                    <Insight
                        eyebrow="Evolução · Semanal"
                        headline={`Pedidos online ${onlineGrowth >= 0 ? '+' : ''}${onlineGrowth}% em ${weeks.length} semanas.`}
                        sub="Online (verde claro) empilhado sobre direto (verde)"
                    />
                    <ChartCard padding={14}>
                        <StackedArea
                            weeks={weeks}
                            width={326}
                            height={140}
                            animKey={`${animKey}-mk-sa`}
                        />
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 14, marginTop: 4,
                        }}>
                            <LegendDot color="#13ec13" label="online" />
                            <LegendDot color="#10b981" label="direto" />
                        </div>
                    </ChartCard>
                </section>
            )}

            {/* 4. TICKET MÉDIO POR CANAL ───────────────────────────────────── */}
            <section>
                <Insight
                    eyebrow="Ticket por pedido · Canal"
                    headline={`Online ${ticketOnline >= ticketDireto ? 'lidera' : 'abaixo'} com ${fmtBRL(ticketOnline)}.`}
                    sub={`Direto: ${fmtBRL(ticketDireto)} · média por pedido (não por cliente/dia)`}
                />
                <ChartCard padding={14}>
                    <TicketCompare
                        ticketOnline={ticketOnline}
                        ticketDireto={ticketDireto}
                        animKey={`${animKey}-mk-tc`}
                    />
                </ChartCard>
            </section>

        </div>
    )
}

// ── ChannelRow ────────────────────────────────────────────────────────────────
interface ChannelRowProps {
    color: string
    label: string
    pct: number
    fat: number
    ped: number
}

function ChannelRow({ color, label, pct, fat, ped }: ChannelRowProps) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: `${color}1f`, color,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C_FG, flex: 1 }}>{label}</span>
                <span style={{
                    fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                    fontSize: 12, fontWeight: 700, color: C_MUTED_FG,
                }}>{pct}%</span>
            </div>
            <div style={{
                marginTop: 3, paddingLeft: 28,
                fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                fontSize: 12, fontWeight: 600, color: C_FG, letterSpacing: '-0.01em',
            }}>
                {fmtBRL(fat)}{' '}
                <span style={{ color: C_MUTED_FG, fontWeight: 500 }}>· {fmtNum(ped)} pedidos</span>
            </div>
        </div>
    )
}

// ── TicketCompare ─────────────────────────────────────────────────────────────
interface TicketCompareProps {
    ticketOnline: number
    ticketDireto: number
    animKey: string | number
}

function TicketCompare({ ticketOnline, ticketDireto, animKey }: TicketCompareProps) {
    const max = Math.max(ticketOnline, ticketDireto) || 1
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CompareRow label="Online" value={ticketOnline} max={max}
                        color="#13ec13" animKey={`${animKey}-o`} />
            <CompareRow label="Direto" value={ticketDireto} max={max}
                        color="#10b981" animKey={`${animKey}-d`} />
        </div>
    )
}

// ── CompareRow ────────────────────────────────────────────────────────────────
interface CompareRowProps {
    label: string
    value: number
    max: number
    color: string
    animKey: string | number
}

function CompareRow({ label, value, max, color, animKey }: CompareRowProps) {
    const t = useAnim([animKey])
    const pct = max > 0 ? (value / max) * 100 * t : 0
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C_FG }}>{label}</span>
                <span style={{
                    fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                    fontSize: 12, fontWeight: 700, color: C_FG,
                }}>{fmtBRL(value)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: C_MUTED }}>
                <div style={{
                    height: '100%', borderRadius: 999, background: color,
                    width: `${pct}%`,
                    transition: 'width 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
                }} />
            </div>
        </div>
    )
}
