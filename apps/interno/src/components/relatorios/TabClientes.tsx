import { useMemo } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { useRptLtvPorCliente } from '../../hooks/useRelatorios'
import {
    HBars,
    C_FG, C_MUTED_FG, C_MONO,
} from './Charts'
import {
    fmtBRL, fmtNum,
    Insight, ChartCard, EmptyState,
} from './RelatoriosUI'

interface Props { animKey: string | number }

function diasSemComprar(ultimaCompra: string | null): number {
    if (!ultimaCompra) return 999
    return Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / 86400000)
}

export function TabClientes({ animKey }: Props) {
    const { data: clientes = [], isLoading, isError } = useRptLtvPorCliente()

    const derived = useMemo(() => {
        if (!clientes.length) return null

        const totalLtv = clientes.reduce((s, c) => s + (c.ltv_total ?? 0), 0)
        const ativos   = clientes.filter(c => c.status_atividade !== 'adormecido').length
        const ltvMedio  = clientes.length ? totalLtv / clientes.length : 0
        const ticketMedio = clientes.length
            ? clientes.reduce((s, c) => s + (c.ticket_medio ?? 0), 0) / clientes.length
            : 0

        const top20Count = Math.ceil(clientes.length * 0.2)
        const top20Ltv   = clientes.slice(0, top20Count).reduce((s, c) => s + (c.ltv_total ?? 0), 0)
        const paretoTopPct = totalLtv > 0 ? Math.round(top20Ltv / totalLtv * 100) : 0

        // Top 7 by LTV
        const topByLtv = clientes.slice(0, 7).map(c => ({
            id: c.contato_id,
            label: c.nome,
            value: c.ltv_total ?? 0,
            color: c.tipo === 'B2B' ? '#3B82F6' : '#7c3aed',
        }))

        // Em risco
        const emRisco = clientes
            .filter(c => c.status_atividade === 'risco' || c.status_atividade === 'adormecido')
            .map(c => ({ ...c, ultimaDias: diasSemComprar(c.ultima_compra) }))
            .sort((a, b) => b.ultimaDias - a.ultimaDias)

        return {
            ativos, ltvMedio, ticketMedio, totalLtv, top20Count, paretoTopPct, top20Ltv,
            topByLtv, emRisco,
        }
    }, [clientes])

    if (isLoading) return <EmptyState msg="Carregando dados de clientes…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados de clientes." />
    if (!derived)  return <EmptyState msg="Sem dados de clientes disponíveis." />

    const {
        ativos, ltvMedio, ticketMedio, totalLtv, top20Count, paretoTopPct, top20Ltv,
        topByLtv, emRisco,
    } = derived

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* 1. KPI GRID ─────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                    { label: 'Ativos',    value: fmtNum(ativos) },
                    { label: 'LTV médio', value: fmtBRL(ltvMedio) },
                    { label: 'Ticket',    value: fmtBRL(ticketMedio) },
                ].map(k => (
                    <div key={k.label} style={{
                        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                        borderRadius: 14, padding: '11px 12px', boxShadow: 'var(--shadow-card)',
                    }}>
                        <div style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.06em', color: C_MUTED_FG,
                        }}>{k.label}</div>
                        <div style={{
                            fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                            fontSize: 18, fontWeight: 700, color: C_FG,
                            letterSpacing: '-0.03em', marginTop: 3, lineHeight: 1,
                        }}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* 2. CONCENTRAÇÃO ─────────────────────────────────────────────── */}
            <ChartCard padding={16}>
                <Insight
                    eyebrow="Concentração"
                    headline={`Os top 20% dos clientes geram ${paretoTopPct}% da receita.`}
                    sub={`${top20Count} clientes respondem por ${fmtBRL(top20Ltv)} dos ${fmtBRL(totalLtv)} totais.`}
                />
            </ChartCard>

            {/* 3. TOP CLIENTES POR LTV ────────────────────────────────────── */}
            {topByLtv.length > 0 && (
                <section>
                    <Insight
                        eyebrow="Ranking · LTV"
                        headline={`Top ${topByLtv.length} clientes por valor total.`}
                        sub="Clientes com maior receita acumulada."
                    />
                    <ChartCard padding={14}>
                        <HBars
                            animKey={`${animKey}-tc`}
                            data={topByLtv}
                            fmtValue={fmtBRL}
                            width={326}
                        />
                    </ChartCard>
                </section>
            )}

            {/* 4. EM RISCO ─────────────────────────────────────────────────── */}
            {emRisco.length > 0 && (
                <section>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.12em', color: '#b91c1c', marginBottom: 8,
                    }}>
                        <AlertTriangle size={11} strokeWidth={2.4} style={{ color: '#b91c1c' }} />
                        <span style={{ color: '#b91c1c' }}>Em risco · sem comprar</span>
                    </div>
                    <ChartCard padding={0}>
                        {emRisco.map((c, i) => (
                            <RiskRow key={c.contato_id ?? i}
                                     nome={c.nome ?? '—'}
                                     status={c.status_atividade ?? 'risco'}
                                     ultimaDias={c.ultimaDias}
                                     ltv={c.ltv_total ?? 0}
                                     tipo={c.tipo ?? ''}
                                     last={i === emRisco.length - 1}
                            />
                        ))}
                    </ChartCard>
                </section>
            )}

        </div>
    )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface RiskRowProps {
    nome: string
    status: string
    ultimaDias: number
    ltv: number
    tipo: string
    last: boolean
}

function RiskRow({ nome, status, ultimaDias, ltv, tipo, last }: RiskRowProps) {
    const isAdormecido = status === 'adormecido'
    const color = isAdormecido ? '#ef4444' : '#E5A50A'
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            borderBottom: last ? 'none' : `1px solid hsl(var(--border))`,
            minHeight: 54,
        }}>
            <span style={{ flexShrink: 0, width: 4, height: 32, borderRadius: 999, background: color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 13, fontWeight: 700, color: C_FG,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{nome}</div>
                <div style={{
                    marginTop: 2, fontSize: 11, color: C_MUTED_FG, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums',
                }}>
                    <span style={{ color, fontWeight: 700 }}>{ultimaDias}d</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span>LTV {fmtBRL(ltv)}</span>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span style={{ fontFamily: 'Lexend' }}>{tipo}</span>
                </div>
            </div>
            <ChevronRight size={16} strokeWidth={2.4} style={{ color: C_MUTED_FG, flexShrink: 0 }} />
        </div>
    )
}
