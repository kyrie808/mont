import { RefreshCw, Megaphone, Radio } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { useToast } from '../components/ui/Toast'
import { useRptCampanhas, useRptCampanhasPromocao } from '../hooks/useRelatorios'
import { useSincronizarCampanhasMeta } from '../hooks/useCampanhas'
import { Insight, ChartCard, EmptyState, fmtBRL, fmtNum } from '../components/relatorios/RelatoriosUI'
import { C_MUTED_FG, COL_PRIMARY } from '../components/relatorios/Charts'

const colHead = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'

// Objetivo da campanha na Meta → rótulo curto em PT.
const OBJETIVO_LABEL: Record<string, string> = {
    OUTCOME_ENGAGEMENT: 'Engajamento',
    OUTCOME_TRAFFIC: 'Tráfego',
    OUTCOME_LEADS: 'Leads',
    OUTCOME_SALES: 'Vendas',
    OUTCOME_AWARENESS: 'Reconhecimento',
    OUTCOME_APP_PROMOTION: 'App',
}
const objetivoLabel = (o: string | null) => (o ? OBJETIVO_LABEL[o] ?? o : null)

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

export function Campanhas() {
    const toast = useToast()
    const { data: campanhas = [], isLoading } = useRptCampanhas()
    const { data: promocoes = [] } = useRptCampanhasPromocao()
    const sync = useSincronizarCampanhasMeta()

    // Tráfego = campanhas sincronizadas da Meta (origem='meta'). O resto (Copa/promo) sai daqui.
    const trafego = campanhas.filter((c) => c.origem_campanha === 'meta')

    const handleSync = async () => {
        try {
            const r = await sync.mutateAsync()
            toast.success(`Sincronizado: ${fmtNum(r.upserts ?? 0)} campanha(s) da Meta.`)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Falha ao sincronizar com a Meta')
        }
    }

    return (
        <>
            <Header title="Campanhas" showBack />
            <PageContainer className="pt-0 pb-24 bg-transparent">
                <div className="grid gap-[18px] pt-4 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-8">

                    {/* TRÁFEGO (META) ─────────────────────────────────────────── */}
                    <section className="lg:col-span-12">
                        <div className="mb-2.5 flex items-end justify-between gap-3 pl-1">
                            <Insight
                                eyebrow="Tráfego (Meta)"
                                headline={
                                    trafego.length > 0
                                        ? `${fmtNum(trafego.length)} campanha${trafego.length === 1 ? '' : 's'} de tráfego vindas da Meta.`
                                        : 'Nenhuma campanha sincronizada ainda.'
                                }
                                sub="Sincronizadas direto da conta de anúncios. O lead atribui-se a uma delas no cadastro."
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
                                    Configure o token da Meta e clique em “Sincronizar agora”.
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: '1px solid hsl(var(--border))' }}>
                                        <span className={colHead} style={{ flex: 1 }}>Campanha</span>
                                        <span className={colHead} style={{ width: 84, textAlign: 'right' }}>Status</span>
                                        <span className={colHead} style={{ width: 56, textAlign: 'right' }}>Leads</span>
                                        <span className={colHead} style={{ width: 66, textAlign: 'right' }}>Compraram</span>
                                        <span className={colHead} style={{ width: 74, textAlign: 'right' }}>Receita</span>
                                        <span className={colHead} style={{ width: 60, textAlign: 'right' }}>Gasto</span>
                                        <span className={colHead} style={{ width: 52, textAlign: 'right' }}>ROAS</span>
                                    </div>
                                    {trafego.map((c, i) => (
                                        <div key={c.campanha_id ?? i} style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px',
                                            borderBottom: i === trafego.length - 1 ? 'none' : '1px solid hsl(var(--border))',
                                        }}>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span className="block text-sm font-bold text-foreground" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                                                {objetivoLabel(c.meta_objetivo) && (
                                                    <span className="text-[11px] font-medium text-muted-foreground">{objetivoLabel(c.meta_objetivo)}</span>
                                                )}
                                            </span>
                                            <span style={{ width: 84, textAlign: 'right' }}><StatusBadge status={c.meta_status} /></span>
                                            <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" style={{ width: 56, textAlign: 'right' }}>{fmtNum(c.leads ?? 0)}</span>
                                            <span className="font-mono text-sm font-bold tabular-nums" style={{ width: 66, textAlign: 'right', color: (c.converteram ?? 0) > 0 ? '#0a8a0a' : C_MUTED_FG }}>{fmtNum(c.converteram ?? 0)}</span>
                                            <span className="font-mono text-sm font-bold tabular-nums text-foreground" style={{ width: 74, textAlign: 'right' }}>{fmtBRL(Number(c.receita_gerada ?? 0))}</span>
                                            <span className="font-mono text-sm tabular-nums text-muted-foreground/50" style={{ width: 60, textAlign: 'right' }}>—</span>
                                            <span className="font-mono text-sm tabular-nums text-muted-foreground/50" style={{ width: 52, textAlign: 'right' }}>—</span>
                                        </div>
                                    ))}
                                    <div style={{ padding: '9px 14px', borderTop: '1px solid hsl(var(--border))' }}>
                                        <span className="text-xs text-muted-foreground">Gasto e ROAS chegam na próxima fase (leitura de investimento da Meta).</span>
                                    </div>
                                </>
                            )}
                        </ChartCard>
                    </section>

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
