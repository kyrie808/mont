import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, Users, Clock, Megaphone, Gift, Tag } from 'lucide-react'
import {
    useRptLtvPorCliente, useRptAquisicaoMensal, useRptRankingIndicacoes,
    useRptCampanhas, useRptAquisicaoFonte, useRptPromocoes,
} from '../../hooks/useRelatorios'
import type { PeriodoRel } from '../../services/relatorioService'
import { IndicadosDetalhe } from '../dashboard/IndicadosDetalhe'
import {
    Donut, AreaChart,
    C_MUTED_FG, C_MUTED, C_MONO, COL_PRIMARY, COL_WARNING,
} from './Charts'
import {
    fmtBRL, fmtNum,
    Insight, ChartCard, MiniStat, EmptyState, SectionEyebrow, MES_ABBREV,
} from './RelatoriosUI'

const FONTE_LABEL: Record<string, string> = {
    meta_ads: 'Meta Ads', google_ads: 'Google Ads', tiktok_ads: 'TikTok Ads',
}

interface Props { animKey: string | number; periodo: PeriodoRel }

// Origem do cliente (de onde veio). Tons categóricos; indicação = verde-marca
// (canal que mais retribui), direto = cinza (o "sem origem marcada"), anúncio = laranja (pago).
const ORIGEM_META: Record<string, { label: string; color: string }> = {
    direto:    { label: 'Direto',    color: '#64748b' },
    indicacao: { label: 'Indicação', color: COL_PRIMARY },
    catalogo:  { label: 'Catálogo',  color: '#3b82f6' },
    anuncio:   { label: 'Anúncio',   color: COL_WARNING },
    instagram: { label: 'Instagram', color: '#d946ef' },
    facebook:  { label: 'Facebook',  color: '#2563eb' },
    ifood:     { label: 'iFood',     color: '#ea580c' },
}
const metaDe = (o: string) => ORIGEM_META[o] ?? { label: o, color: C_MUTED_FG }

// Cabeçalho de coluna de tabela — na escala do sistema (não px minúsculo).
const colHead = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

function diasSemComprar(ultima: string | null): number {
    if (!ultima) return 9999
    return Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000)
}

export function TabMarketing({ animKey, periodo }: Props) {
    const navigate = useNavigate()
    const [verTodosOneTimer, setVerTodosOneTimer] = useState(false)
    const [expandEmbaixador, setExpandEmbaixador] = useState<string | null>(null)

    const { data: clientes = [], isLoading: l1, isError: e1 } = useRptLtvPorCliente({ tipo: 'geral' })
    const { data: aquisicao = [], isLoading: l2, isError: e2 } = useRptAquisicaoMensal()
    const { data: indicadores = [] } = useRptRankingIndicacoes()
    const { data: campanhas = [] } = useRptCampanhas()
    const { data: fontes = [] } = useRptAquisicaoFonte()
    const { data: promocoesRows = [] } = useRptPromocoes(periodo)
    const promocoes = promocoesRows[0]

    const isLoading = l1 || l2
    const isError = e1 || e2

    const topEmbaixadores = useMemo(
        () => indicadores.filter(i => (i.total_indicados ?? 0) > 0).slice(0, 6),
        [indicadores],
    )

    const derived = useMemo(() => {
        if (!clientes.length && !aquisicao.length) return null

        // ── AQUISIÇÃO no período (fluxo) ──────────────────────────────────────
        const inScope = (r: typeof aquisicao[number]) =>
            periodo.tipo === 'geral' || (r.ano === periodo.ano && r.mes === periodo.mes)
        const aqScope = aquisicao.filter(inScope)
        const novosLeads       = aqScope.reduce((s, r) => s + (r.novos_leads ?? 0), 0)
        const novosCompradores = aqScope.reduce((s, r) => s + (r.novos_compradores ?? 0), 0)

        const mixMap = new Map<string, number>()
        for (const r of aqScope) {
            const o = r.origem ?? 'direto'
            mixMap.set(o, (mixMap.get(o) ?? 0) + (r.novos_leads ?? 0))
        }
        const mixOrigem = [...mixMap.entries()]
            .map(([origem, leads]) => ({ origem, leads, ...metaDe(origem) }))
            .sort((a, b) => b.leads - a.leads)
        const topOrigem = mixOrigem[0]
        const topPct = novosLeads > 0 && topOrigem ? Math.round(topOrigem.leads / novosLeads * 100) : 0

        // ── Série mensal de novos contatos (todos os meses; destaca o selecionado) ─
        const mesMap = new Map<string, { ano: number; mes: number; leads: number }>()
        for (const r of aquisicao) {
            if (r.ano == null || r.mes == null) continue
            const k = `${r.ano}-${String(r.mes).padStart(2, '0')}`
            const acc = mesMap.get(k) ?? { ano: r.ano, mes: r.mes, leads: 0 }
            acc.leads += r.novos_leads ?? 0
            mesMap.set(k, acc)
        }
        const serie = [...mesMap.values()]
            .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
            .slice(-12)
        const serieData = serie.map(s => s.leads)
        const serieLabels = serie.map(s => MES_ABBREV[s.mes - 1] ?? '')
        const currentIndex = periodo.tipo === 'mes'
            ? serie.findIndex(s => s.ano === periodo.ano && s.mes === periodo.mes)
            : undefined

        // ── QUALIDADE por origem (vitalício, compradores) ────────────────────
        const qMap = new Map<string, { n: number; ltv: number; recompra: number }>()
        for (const c of clientes) {
            const o = c.origem ?? 'direto'
            const acc = qMap.get(o) ?? { n: 0, ltv: 0, recompra: 0 }
            acc.n += 1
            acc.ltv += c.ltv_total ?? 0
            if ((c.total_pedidos ?? 0) >= 2) acc.recompra += 1
            qMap.set(o, acc)
        }
        const qualidade = [...qMap.entries()]
            .map(([origem, v]) => ({
                origem, ...metaDe(origem),
                n: v.n,
                ltvMedio: v.n > 0 ? v.ltv / v.n : 0,
                voltaramPct: v.n > 0 ? Math.round(v.recompra / v.n * 100) : 0,
            }))
            .sort((a, b) => b.n - a.n)

        // ── JORNADA (vitalício) ──────────────────────────────────────────────
        const totalLeads   = aquisicao.reduce((s, r) => s + (r.novos_leads ?? 0), 0)
        const compraram    = clientes.length
        const recompraram  = clientes.filter(c => (c.total_pedidos ?? 0) >= 2).length
        const fieis        = clientes.filter(c => (c.total_pedidos ?? 0) >= 6).length
        // Funil ANINHADO (cada etapa ⊂ anterior): contatos → compraram → de novo → fiéis.
        const funil = [
            { id: 'leads',   label: 'Contatos',          n: totalLeads,  color: '#64748b' },
            { id: 'compr',   label: 'Compraram',         n: compraram,   color: '#3b82f6' },
            { id: 'recompr', label: 'Compraram de novo', n: recompraram, color: COL_PRIMARY },
            { id: 'fieis',   label: 'Fiéis (6+)',        n: fieis,       color: '#7c3aed' },
        ]
        // Quem indica é uma PONTA à parte (não precisa ser fiel) → taxa sobre quem comprou.
        const embaixadores = indicadores.filter(i => (i.total_convertidos ?? 0) > 0).length
        const embaixadoresReceita = indicadores.reduce((s, i) => s + Number(i.total_vendas_indicados ?? 0), 0)
        const advocacyPct = compraram > 0 ? Math.round(embaixadores / compraram * 100) : 0

        // ── FREQUÊNCIA de compra (vitalício) ─────────────────────────────────
        const um        = clientes.filter(c => (c.total_pedidos ?? 0) === 1).length
        const dois       = clientes.filter(c => (c.total_pedidos ?? 0) === 2).length
        const tresCinco = clientes.filter(c => { const n = c.total_pedidos ?? 0; return n >= 3 && n <= 5 }).length
        const seisMais  = clientes.filter(c => (c.total_pedidos ?? 0) >= 6).length
        const retencao = [
            { id: '1',   label: '1 compra',   n: um,        color: COL_WARNING },
            { id: '2',   label: '2 compras',  n: dois,      color: '#3b82f6' },
            { id: '35',  label: '3 a 5',      n: tresCinco, color: COL_PRIMARY },
            { id: '6',   label: '6 ou mais',  n: seisMais,  color: '#7c3aed' },
        ]
        const umPct = compraram > 0 ? Math.round(um / compraram * 100) : 0

        // clientes de 1 compra por tempo sem voltar (candidatos a chamar de volta)
        const oneTimers = clientes
            .filter(c => (c.total_pedidos ?? 0) === 1)
            .map(c => ({ contatoId: c.contato_id, nome: c.nome ?? '—', dias: diasSemComprar(c.ultima_compra), ltv: c.ltv_total ?? 0 }))
        const fresh  = oneTimers.filter(o => o.dias <= 30).length
        const golden = oneTimers.filter(o => o.dias > 30 && o.dias <= 90)
        const cold   = oneTimers.filter(o => o.dias > 90).length
        const recuperaveis = [...golden].sort((a, b) => b.ltv - a.ltv)
        const recuperavelValor = golden.reduce((s, o) => s + o.ltv, 0)

        return {
            novosLeads, novosCompradores, mixOrigem, topOrigem, topPct,
            serieData, serieLabels, currentIndex,
            qualidade,
            funil, totalLeads, compraram,
            embaixadores, embaixadoresReceita, advocacyPct,
            retencao, umPct, fresh, coldCount: cold, recuperaveis, recuperavelValor,
        }
    }, [clientes, aquisicao, indicadores, periodo])

    if (isLoading) return <EmptyState msg="Carregando dados de marketing…" />
    if (isError)   return <EmptyState msg="Falha ao carregar dados de marketing." />
    if (!derived)  return <EmptyState msg="Sem dados de marketing disponíveis." />

    const {
        novosLeads, novosCompradores, mixOrigem, topOrigem, topPct,
        serieData, serieLabels, currentIndex,
        qualidade,
        funil, totalLeads, compraram,
        embaixadores, embaixadoresReceita, advocacyPct,
        retencao, umPct, fresh, coldCount, recuperaveis, recuperavelValor,
    } = derived

    const isMes = periodo.tipo === 'mes'
    const aquisicaoHeadline = topOrigem
        ? (isMes
            ? `${topPct}% dos clientes novos do mês vieram de ${topOrigem.label.toLowerCase()}.`
            : `${topPct}% dos clientes vieram de ${topOrigem.label.toLowerCase()}.`)
        : (isMes ? 'Nenhum cliente novo no mês.' : 'Sem clientes ainda.')

    return (
        <div className="grid gap-[18px] lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8">

            {/* 1. DE ONDE VÊM OS CLIENTES (período) ───────────────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="De onde vêm os clientes"
                    headline={aquisicaoHeadline}
                    sub={`${fmtNum(novosLeads)} ${isMes ? 'contatos novos' : 'contatos'} · ${fmtNum(novosCompradores)} já compraram`}
                />
                <ChartCard padding={16}>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* mix por origem */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {novosLeads > 0 && (
                                <Donut
                                    animKey={`${animKey}-mk-mix`}
                                    segments={mixOrigem.map(m => ({
                                        pct: novosLeads > 0 ? m.leads / novosLeads * 100 : 0,
                                        color: m.color, label: m.label, value: m.leads,
                                    }))}
                                    centerLabel={`${topPct}%`}
                                    centerSub={topOrigem?.label.toLowerCase()}
                                    size={124}
                                    fmtValue={(v) => fmtNum(v)}
                                />
                            )}
                            <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 9 }}>
                                {mixOrigem.slice(0, 5).map(m => (
                                    <div key={m.origem} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 9, height: 9, borderRadius: 3, background: m.color, flexShrink: 0 }} />
                                        <span className="text-sm font-medium text-foreground" style={{ flex: 1 }}>{m.label}</span>
                                        <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">{fmtNum(m.leads)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* série mensal */}
                        <div>
                            <SectionEyebrow icon={<Clock size={11} strokeWidth={2.4} />}>Contatos novos por mês</SectionEyebrow>
                            <AreaChart
                                data={serieData}
                                labels={serieLabels}
                                currentIndex={currentIndex != null && currentIndex >= 0 ? currentIndex : undefined}
                                animKey={`${animKey}-mk-serie`}
                                height={150}
                                fmtAxis={(v) => fmtNum(v)}
                                fmtValue={(v) => `${fmtNum(v)} ${v === 1 ? 'contato' : 'contatos'}`}
                            />
                        </div>
                    </div>
                </ChartCard>
            </section>

            {/* 2. JORNADA DO CLIENTE ──────────────────────────────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="Jornada do cliente"
                    headline={`De ${fmtNum(totalLeads)} contatos, ${fmtNum(compraram)} viraram clientes.`}
                    sub="Quantos avançam em cada etapa. O maior tombo mostra onde focar."
                />
                <ChartCard padding={16}>
                    <FunnelChart etapas={funil} animKey={`${animKey}-mk-funil`} />
                    {/* quem indica — uma ponta à parte */}
                    <div style={{
                        marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border))',
                        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                        <span style={{
                            flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                            background: 'rgba(19,236,19,.10)', color: '#0a8a0a',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Users size={17} strokeWidth={2.2} />
                        </span>
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <div className={colHead}>Quem indica</div>
                            <div className="mt-0.5 text-sm font-bold text-foreground">
                                {fmtNum(embaixadores)} clientes já trouxeram outros ({advocacyPct}% dos que compraram)
                            </div>
                        </div>
                        <div style={{
                            fontFamily: C_MONO, color: '#0a8a0a', background: 'rgba(19,236,19,.10)',
                            padding: '4px 10px', borderRadius: 999, flexShrink: 0,
                        }} className="text-sm font-bold tabular-nums">{fmtBRL(embaixadoresReceita)} gerados</div>
                    </div>
                </ChartCard>
            </section>

            {/* 3. QUALIDADE POR ORIGEM + FREQUÊNCIA (par de mesma altura) ──── */}
            <section className="lg:col-span-6 lg:flex lg:flex-col">
                <Insight
                    eyebrow="Qual origem traz cliente que volta"
                    headline="Origens diferentes trazem clientes diferentes."
                    sub="Quanto cada cliente gasta, em média, e quantos voltam a comprar."
                />
                <ChartCard padding={0} className="lg:flex-1">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                        <span className={colHead} style={{ flex: 1 }}>Origem</span>
                        <span className={colHead} style={{ width: 52, textAlign: 'right' }}>Clientes</span>
                        <span className={colHead} style={{ width: 68, textAlign: 'right' }}>Gasto méd.</span>
                        <span className={colHead} style={{ width: 62, textAlign: 'right' }}>Voltaram</span>
                    </div>
                    {qualidade.map((q, i) => (
                        <div key={q.origem} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                            borderBottom: i === qualidade.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                        }}>
                            <span style={{ width: 8, height: 8, borderRadius: 3, background: q.color, flexShrink: 0 }} />
                            <span className="text-sm font-bold text-foreground" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.label}</span>
                            <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" style={{ width: 52, textAlign: 'right' }}>{fmtNum(q.n)}</span>
                            <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 68, textAlign: 'right' }}>{fmtBRL(q.ltvMedio)}</span>
                            <span className="font-mono text-sm font-bold tabular-nums" style={{ width: 62, textAlign: 'right', color: q.voltaramPct >= 40 ? '#0a8a0a' : q.voltaramPct <= 15 ? '#b91c1c' : C_MUTED_FG }}>{q.voltaramPct}%</span>
                        </div>
                    ))}
                </ChartCard>
            </section>

            <section className="lg:col-span-6 lg:flex lg:flex-col">
                <Insight
                    eyebrow="Frequência de compra"
                    headline={`${umPct}% dos clientes compraram só 1 vez.`}
                    sub="Fazer quem comprou uma vez voltar é o maior ganho."
                />
                <ChartCard padding={14} className="lg:flex-1">
                    <div style={{ display: 'flex', height: 14, borderRadius: 999, overflow: 'hidden', background: C_MUTED, marginBottom: 12 }}>
                        {retencao.map(r => (
                            <div key={r.id} style={{ width: `${compraram > 0 ? (r.n / compraram) * 100 : 0}%`, background: r.color }} />
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {retencao.map(r => (
                            <div key={r.id} style={{ borderRadius: 10, padding: '9px 8px', background: 'hsl(var(--muted) / 0.35)', border: '1px solid hsl(var(--border))', borderLeft: `3px solid ${r.color}` }}>
                                <div className="text-[11px] font-semibold text-muted-foreground">{r.label}</div>
                                <div className="mt-1 font-mono text-lg font-bold tabular-nums leading-none text-foreground">{fmtNum(r.n)}</div>
                            </div>
                        ))}
                    </div>
                    {/* clientes de 1 compra, por tempo sem voltar */}
                    <div style={{ marginTop: 14 }}>
                        <SectionEyebrow icon={<Clock size={11} strokeWidth={2.4} style={{ color: COL_WARNING }} />}>
                            Quem comprou 1 vez, por tempo sem voltar
                        </SectionEyebrow>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                            <MiniStat label="Até 30 dias"     value={fmtNum(fresh)} />
                            <MiniStat label="31 a 90 dias"    value={fmtNum(recuperaveis.length)} accent={COL_WARNING} />
                            <MiniStat label="Mais de 90 dias" value={fmtNum(coldCount)} />
                        </div>
                    </div>
                </ChartCard>
            </section>

            {/* 4. CLIENTES PRA CHAMAR DE VOLTA (largura cheia) ─────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="Clientes pra chamar de volta"
                    headline={`${fmtNum(recuperaveis.length)} clientes compraram 1 vez e sumiram faz 1 a 3 meses — ${fmtBRL(recuperavelValor)} em jogo.`}
                    sub="Ainda dá pra trazer de volta: chame no WhatsApp, ofereça um brinde ou um desconto."
                />
                <ChartCard padding={0}>
                    {recuperaveis.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            <Users size={20} style={{ opacity: 0.4, marginBottom: 6, display: 'inline-block' }} /><br />
                            Ninguém de 1 compra sumido nesse período.
                        </div>
                    ) : (
                        <div className="lg:grid lg:grid-cols-2">
                            {(verTodosOneTimer ? recuperaveis : recuperaveis.slice(0, 8)).map((c, i) => (
                                <button
                                    key={c.contatoId ?? i}
                                    type="button"
                                    onClick={() => c.contatoId && navigate(`/contatos/${c.contatoId}`)}
                                    className="border-b border-border last:border-b-0 lg:odd:border-r"
                                    style={{
                                        width: '100%', textAlign: 'left', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', minHeight: 54,
                                        borderLeftWidth: 0, borderTopWidth: 0,
                                    }}
                                >
                                    <span style={{ flexShrink: 0, width: 4, height: 32, borderRadius: 999, background: COL_WARNING }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="text-sm font-bold text-foreground" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</div>
                                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ color: COL_WARNING, fontWeight: 700 }}>{c.dias}d sem voltar</span>
                                            <span style={{ opacity: 0.4 }}>·</span>
                                            <span>gastou {fmtBRL(c.ltv)}</span>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} strokeWidth={2.4} style={{ color: C_MUTED_FG, flexShrink: 0 }} />
                                </button>
                            ))}
                            {recuperaveis.length > 8 && (
                                <button
                                    type="button"
                                    onClick={() => setVerTodosOneTimer(v => !v)}
                                    className="border-t border-border text-xs font-bold text-muted-foreground lg:col-span-2"
                                    style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px', background: 'transparent', borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, cursor: 'pointer' }}
                                >
                                    {verTodosOneTimer ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    {verTodosOneTimer ? 'Ver menos' : `Ver todos (${recuperaveis.length})`}
                                </button>
                            )}
                        </div>
                    )}
                </ChartCard>
            </section>

            {/* 5. CAMPANHAS + EMBAIXADORES (par de mesma altura) ───────────── */}
            <section className="lg:col-span-6 lg:flex lg:flex-col">
                <Insight
                    eyebrow="Campanhas de anúncio"
                    headline={campanhas.length > 0 ? `${fmtNum(campanhas.length)} campanhas cadastradas.` : 'Nenhuma campanha ainda.'}
                    sub="Quantos contatos cada campanha trouxe e quantos compraram."
                />
                <ChartCard padding={0} className="lg:flex-1">
                    {campanhas.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            <Megaphone size={20} style={{ opacity: 0.4, marginBottom: 6, display: 'inline-block' }} /><br />
                            Marque a campanha no cadastro do cliente (origem = Anúncio).
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                                <span className={colHead} style={{ flex: 1 }}>Campanha</span>
                                <span className={colHead} style={{ width: 56, textAlign: 'right' }}>Contatos</span>
                                <span className={colHead} style={{ width: 66, textAlign: 'right' }}>Compraram</span>
                                <span className={colHead} style={{ width: 66, textAlign: 'right' }}>Receita</span>
                            </div>
                            {campanhas.map((c, i) => (
                                <div key={c.campanha_id ?? i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                                    borderBottom: i === campanhas.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                }}>
                                    <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: 999, background: c.ativo ? COL_PRIMARY : C_MUTED_FG }} />
                                    <span className="text-sm font-bold text-foreground" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                                    <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" style={{ width: 56, textAlign: 'right' }}>{fmtNum(c.leads ?? 0)}</span>
                                    <span className="font-mono text-sm font-bold tabular-nums" style={{ width: 66, textAlign: 'right', color: (c.converteram ?? 0) > 0 ? '#0a8a0a' : C_MUTED_FG }}>{fmtNum(c.converteram ?? 0)}</span>
                                    <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 66, textAlign: 'right' }}>{fmtBRL(Number(c.receita_gerada ?? 0))}</span>
                                </div>
                            ))}
                            {fontes.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid hsl(var(--border))' }}>
                                    <span className="text-xs font-semibold text-muted-foreground">Anúncios:</span>
                                    {fontes.map(f => (
                                        <span key={f.fonte} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                                            {FONTE_LABEL[f.fonte ?? ''] ?? f.fonte} · <span className="font-mono tabular-nums text-muted-foreground">{fmtNum(f.leads ?? 0)} contato{(f.leads ?? 0) === 1 ? '' : 's'}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </ChartCard>
            </section>

            <section className="lg:col-span-6 lg:flex lg:flex-col">
                <Insight
                    eyebrow="Quem indica"
                    headline={topEmbaixadores.length > 0 ? `${topEmbaixadores[0].nome ?? '—'} é quem mais indica.` : 'Ninguém indicou ainda.'}
                    sub="Toque num nome pra ver quem a pessoa trouxe e quanto gastaram."
                />
                <ChartCard padding={0} className="lg:flex-1">
                    {topEmbaixadores.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                            <Users size={20} style={{ opacity: 0.4, marginBottom: 6, display: 'inline-block' }} /><br />
                            Nenhuma indicação registrada.
                        </div>
                    ) : topEmbaixadores.map((e, i) => {
                        const id = e.indicador_id ?? ''
                        const aberto = expandEmbaixador === id
                        return (
                            <div key={id || i} style={{ borderBottom: i === topEmbaixadores.length - 1 && !aberto ? 'none' : '1px solid hsl(var(--border))' }}>
                                <button
                                    type="button"
                                    onClick={() => setExpandEmbaixador(aberto ? null : id)}
                                    style={{
                                        width: '100%', textAlign: 'left', background: 'transparent', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', minHeight: 52, border: 'none',
                                    }}
                                >
                                    <span className="font-mono text-xs font-bold" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, background: 'rgba(19,236,19,.10)', color: '#0a8a0a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="text-sm font-bold text-foreground" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.nome ?? '—'}</div>
                                        <div className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                                            {fmtNum(e.total_convertidos ?? 0)} de {fmtNum(e.total_indicados ?? 0)} compraram · {fmtBRL(Number(e.total_vendas_indicados ?? 0))}
                                        </div>
                                    </div>
                                    <ChevronDown size={16} strokeWidth={2.4} style={{ color: C_MUTED_FG, flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>
                                {aberto && id && (
                                    <div style={{ padding: '0 14px 12px' }}>
                                        <IndicadosDetalhe indicadorId={id} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </ChartCard>
            </section>

            {/* 6. BRINDES E DESCONTOS (período; um card só) ────────────────── */}
            <section className="lg:col-span-12">
                <Insight
                    eyebrow="Brindes e descontos"
                    headline="Brindes e descontos pra conquistar e segurar cliente."
                    sub={`Valores ${isMes ? 'no mês' : 'no total'}.`}
                />
                <ChartCard padding={16}>
                    <div className="grid gap-4 lg:grid-cols-2 lg:divide-x lg:divide-border">
                        {/* brindes */}
                        <div className="lg:pr-4">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: 'rgba(124,58,237,.12)', color: '#7c3aed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Gift size={16} strokeWidth={2.2} />
                                </span>
                                <div className="text-sm font-bold uppercase tracking-wide text-foreground">Brindes dados</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                <MiniStat label="Quantidade" value={fmtNum(promocoes?.brindes_qtd ?? 0)} />
                                <MiniStat label="Valor doado" value={fmtBRL(Number(promocoes?.brindes_valor ?? 0))} accent="#7c3aed" />
                                <MiniStat label="Clientes" value={fmtNum(promocoes?.brindes_clientes ?? 0)} />
                            </div>
                        </div>
                        {/* descontos */}
                        <div className="lg:pl-4">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: 'rgba(226,88,0,.12)', color: '#ea580c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Tag size={16} strokeWidth={2.2} />
                                </span>
                                <div className="text-sm font-bold uppercase tracking-wide text-foreground">Descontos dados</div>
                            </div>
                            {(promocoes?.desconto_qtd ?? 0) === 0 ? (
                                <div className="text-sm text-muted-foreground" style={{ paddingTop: 4 }}>
                                    Nenhum desconto dado {isMes ? 'no mês' : 'ainda'}. Aparece aqui quando você usar o campo na Nova Venda.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                                    <MiniStat label="Vendas com desconto" value={fmtNum(promocoes?.desconto_qtd ?? 0)} />
                                    <MiniStat label="Total dado" value={fmtBRL(Number(promocoes?.desconto_total ?? 0))} accent="#ea580c" />
                                </div>
                            )}
                        </div>
                    </div>
                </ChartCard>
            </section>

        </div>
    )
}

// ── FunnelChart ─────────────────────────────────────────────────────────────
interface FunnelEtapa { id: string; label: string; n: number; color: string }

function FunnelChart({ etapas }: { etapas: FunnelEtapa[]; animKey: string | number }) {
    const max = Math.max(...etapas.map(e => e.n), 1)
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {etapas.map((e, i) => {
                const anterior = i > 0 ? etapas[i - 1].n : null
                const convPct = anterior && anterior > 0 ? Math.round(e.n / anterior * 100) : null
                const w = max > 0 ? (e.n / max) * 100 : 0
                return (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="text-sm font-bold text-foreground" style={{ width: 132, flexShrink: 0 }}>{e.label}</span>
                        <div style={{ flex: 1, minWidth: 0, height: 30, borderRadius: 8, background: C_MUTED, position: 'relative', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: `${w}%`, background: e.color, borderRadius: 8,
                                display: 'flex', alignItems: 'center', paddingLeft: 10,
                                transition: 'width 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
                            }}>
                                <span className="font-mono text-sm font-extrabold tabular-nums" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.25)' }}>
                                    {fmtNum(e.n)}
                                </span>
                            </div>
                        </div>
                        <span className="font-mono text-xs font-bold tabular-nums" style={{ width: 56, flexShrink: 0, textAlign: 'right', color: convPct == null ? 'transparent' : convPct >= 50 ? '#0a8a0a' : convPct >= 20 ? C_MUTED_FG : '#b91c1c' }}>
                            {convPct == null ? '—' : `${convPct}%`}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
