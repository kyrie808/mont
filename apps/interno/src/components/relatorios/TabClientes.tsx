import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useRptLtvPorCliente } from '../../hooks/useRelatorios'
import {
    HBars,
    C_FG, C_MUTED_FG, C_MUTED, C_MONO, COL_PRIMARY, COL_WARNING,
} from './Charts'
import {
    fmtBRL, fmtNum,
    Insight, ChartCard, MiniStat, EmptyState,
} from './RelatoriosUI'

interface Props { animKey: string | number }

function diasSemComprar(ultimaCompra: string | null): number {
    if (!ultimaCompra) return 999
    return Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / 86400000)
}

// Aba Clientes = cockpit de relacionamento VITALÍCIO (LTV/churn/risco não cabem num mês).
// Sempre geral, independente do período da página.
export function TabClientes({ animKey }: Props) {
    const navigate = useNavigate()
    const [verTodosRisco, setVerTodosRisco] = useState(false)
    const { data: clientes = [], isLoading, isError } = useRptLtvPorCliente({ tipo: 'geral' })

    const derived = useMemo(() => {
        if (!clientes.length) return null
        const sum = (rows: typeof clientes) => rows.reduce((s, c) => s + (c.ltv_total ?? 0), 0)

        const total = clientes.length
        const ativos      = clientes.filter(c => c.status_atividade === 'ativo')
        const risco       = clientes.filter(c => c.status_atividade === 'risco')
        const adormecidos = clientes.filter(c => c.status_atividade === 'adormecido')

        const totalLtv = sum(clientes)
        const ltvMedio = total ? totalLtv / total : 0
        const ticketMedio = total ? clientes.reduce((s, c) => s + (c.ticket_medio ?? 0), 0) / total : 0

        const funil = [
            { id: 'ativo',      label: 'Ativos',      qtd: ativos.length,      valor: sum(ativos),      color: COL_PRIMARY },
            { id: 'risco',      label: 'Em risco',    qtd: risco.length,       valor: sum(risco),       color: COL_WARNING },
            { id: 'adormecido', label: 'Adormecidos', qtd: adormecidos.length, valor: sum(adormecidos), color: C_MUTED_FG },
        ]
        const adormPct = total ? Math.round(adormecidos.length / total * 100) : 0

        // Concentração (Pareto) — a view já vem ordenada por ltv desc
        const top20Count = Math.ceil(total * 0.2)
        const top20Ltv   = clientes.slice(0, top20Count).reduce((s, c) => s + (c.ltv_total ?? 0), 0)
        const paretoTopPct = totalLtv > 0 ? Math.round(top20Ltv / totalLtv * 100) : 0

        const topByLtv = clientes.slice(0, 8).map(c => ({
            id: c.contato_id, label: c.nome, value: c.ltv_total ?? 0, color: '#7c3aed', // roxo = categoria VIP (design system)
        }))

        // Em risco · recuperar: os que estão escorregando (risco), pelos de MAIOR valor primeiro.
        const recuperar = risco
            .map(c => ({ contatoId: c.contato_id, nome: c.nome ?? '—', dias: diasSemComprar(c.ultima_compra), ltv: c.ltv_total ?? 0 }))
            .sort((a, b) => b.ltv - a.ltv)
        const recuperarValor = risco.reduce((s, c) => s + (c.ltv_total ?? 0), 0)

        return { total, funil, adormPct, ltvMedio, ticketMedio, totalLtv, top20Count, top20Ltv, paretoTopPct, topByLtv, recuperar, recuperarValor, adormCount: adormecidos.length }
    }, [clientes])

    if (isLoading) return <EmptyState msg="Carregando dados de clientes…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados de clientes." />
    if (!derived)  return <EmptyState msg="Sem dados de clientes disponíveis." />

    const { total, funil, adormPct, ltvMedio, ticketMedio, totalLtv, top20Count, top20Ltv, paretoTopPct, topByLtv, recuperar, recuperarValor, adormCount } = derived

    return (
        <div className="grid gap-[18px] lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8 lg:items-start">

            {/* 1. SAÚDE DA BASE ────────────────────────────────────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="Saúde da base · vitalício"
                    headline={`${fmtNum(adormCount)} de ${fmtNum(total)} clientes estão adormecidos (${adormPct}%).`}
                    sub={`LTV médio ${fmtBRL(ltvMedio)} · ticket médio ${fmtBRL(ticketMedio)}`}
                />
                <ChartCard padding={14}>
                    {/* barra empilhada ativo/risco/adormecido */}
                    <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: C_MUTED, marginBottom: 12 }}>
                        {funil.map(f => (
                            <div key={f.id} style={{ width: `${total > 0 ? (f.qtd / total) * 100 : 0}%`, background: f.color }} />
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {funil.map(f => (
                            <div key={f.id} style={{ borderRadius: 10, padding: '10px 12px', background: 'hsl(var(--muted) / 0.35)', border: '1px solid hsl(var(--border))', borderLeft: `3px solid ${f.color}` }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: f.color }}>
                                    <span style={{ width: 7, height: 7, borderRadius: 999, background: f.color }} /> {f.label}
                                </div>
                                <div style={{ fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 700, color: C_FG, letterSpacing: '-0.03em', marginTop: 4, lineHeight: 1 }}>{fmtNum(f.qtd)}</div>
                                <div style={{ fontSize: 10, fontWeight: 500, color: C_MUTED_FG, marginTop: 2, fontFamily: C_MONO }}>{fmtBRL(f.valor)} LTV</div>
                            </div>
                        ))}
                    </div>
                </ChartCard>
            </section>

            {/* 2. CONCENTRAÇÃO ─────────────────────────────────────────────── */}
            <ChartCard padding={16} className="lg:col-span-4">
                <Insight
                    eyebrow="Concentração"
                    headline={`Os top 20% geram ${paretoTopPct}% da receita.`}
                    sub={`${fmtNum(top20Count)} clientes respondem por ${fmtBRL(top20Ltv)} dos ${fmtBRL(totalLtv)} totais.`}
                />
                <div style={{ marginTop: 4, display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: C_MUTED }}>
                    <div style={{ width: `${paretoTopPct}%`, background: '#7c3aed' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <MiniStat label="Top 20%" value={`${paretoTopPct}%`} />
                    <MiniStat label="Resto" value={`${100 - paretoTopPct}%`} />
                </div>
            </ChartCard>

            {/* 3. TOP CLIENTES POR LTV ────────────────────────────────────── */}
            {topByLtv.length > 0 && (
                <section className="lg:col-span-8">
                    <Insight
                        eyebrow="Ranking · LTV (vitalício)"
                        headline={`Top ${topByLtv.length} clientes por valor total.`}
                        sub="Os melhores da base — nutrir e recompensar."
                    />
                    <ChartCard padding={14}>
                        <HBars animKey={`${animKey}-tc`} data={topByLtv} fmtValue={fmtBRL} />
                    </ChartCard>
                </section>
            )}

            {/* 4. EM RISCO · RECUPERAR ─────────────────────────────────────── */}
            {recuperar.length > 0 && (
                <section className="lg:col-span-12">
                    <Insight
                        eyebrow="Em risco · recuperar"
                        headline={`${fmtNum(recuperar.length)} clientes escorregando, valendo ${fmtBRL(recuperarValor)}.`}
                        sub="Estão perto de virar adormecidos — mande um WhatsApp antes de perder."
                    />
                    <ChartCard padding={0}>
                        {(verTodosRisco ? recuperar : recuperar.slice(0, 8)).map((c, i, arr) => (
                            <button
                                key={c.contatoId ?? i}
                                type="button"
                                onClick={() => c.contatoId && navigate(`/contatos/${c.contatoId}`)}
                                style={{
                                    width: '100%', textAlign: 'left', background: 'transparent', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', minHeight: 54,
                                    border: 'none', borderBottom: i === arr.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                }}
                            >
                                <span style={{ flexShrink: 0, width: 4, height: 32, borderRadius: 999, background: COL_WARNING }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C_FG, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                                    <div style={{ marginTop: 2, fontSize: 11, color: C_MUTED_FG, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, fontFamily: C_MONO, fontVariantNumeric: 'tabular-nums' }}>
                                        <span style={{ color: COL_WARNING, fontWeight: 700 }}>{c.dias}d sem comprar</span>
                                        <span style={{ opacity: 0.4 }}>·</span>
                                        <span>LTV {fmtBRL(c.ltv)}</span>
                                    </div>
                                </div>
                                <ChevronRight size={16} strokeWidth={2.4} style={{ color: C_MUTED_FG, flexShrink: 0 }} />
                            </button>
                        ))}
                        {recuperar.length > 8 && (
                            <button
                                type="button"
                                onClick={() => setVerTodosRisco(v => !v)}
                                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px', background: 'transparent', border: 'none', borderTop: '1px solid hsl(var(--border))', cursor: 'pointer', fontFamily: 'Lexend', fontSize: 11, fontWeight: 700, color: C_MUTED_FG }}
                            >
                                {verTodosRisco ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                {verTodosRisco ? 'Ver menos' : `Ver todos (${recuperar.length})`}
                            </button>
                        )}
                    </ChartCard>
                </section>
            )}
        </div>
    )
}
