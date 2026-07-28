import { Phone, AlertTriangle, CheckCircle, MinusCircle, Megaphone, X } from 'lucide-react'
import { cn, formatCurrency, formatDate, formatPhone } from '@mont/shared'
import { useContato } from '../../hooks/useContatos'
import { useContatoTags } from '../../hooks/useTags'
import { useContatoCampanhas, useRemoverCampanha } from '../../hooks/useCampanhas'
import { usePerfilExtras, useLtvContato, useKanbanRowContato } from '../../hooks/usePerfilSideSheet'
import { InteracoesTimeline } from './InteracoesTimeline'
import { TermometroCliente } from './TermometroCliente'
import type { ProdutoRanking } from '../../services/relacionamentoService'

// Painel RICO do cliente — tags · ritmo · financeiro · fiado · última compra · produtos ·
// (opcional) interações. Self-fetching: recebe só `contatoId`. Fonte de verdade única,
// usada no side-sheet do kanban E no perfil do cliente (/contatos/:id).

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textColorForBg(hex: string): string {
    const c = hex.replace('#', '')
    if (c.length < 6) return '#ffffff'
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#ffffff'
}

export function SectionLabel({ children }: { children: string }) {
    return (
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.09em] text-muted-foreground/40">
            {children}
        </p>
    )
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{label}</span>
            <span className="text-[12px] font-medium text-foreground text-right">{value ?? '–'}</span>
        </div>
    )
}

export function FiadoCard({ estado }: { estado: 'em_aberto' | 'quitou' | 'nunca_usou' }) {
    const config = {
        em_aberto: {
            icon: AlertTriangle, label: 'Em aberto', msg: 'Não oferecer mais fiado',
            cls: 'bg-destructive/10 border-destructive/30', iconCls: 'text-destructive',
            labelCls: 'text-destructive', msgCls: 'text-destructive/80',
        },
        quitou: {
            icon: CheckCircle, label: 'Quitou', msg: 'Pode oferecer prazo',
            cls: 'bg-warning/10 border-warning/30', iconCls: 'text-warning',
            labelCls: 'text-warning', msgCls: 'text-warning/80',
        },
        nunca_usou: {
            icon: MinusCircle, label: 'Nunca usou fiado', msg: null,
            cls: 'bg-foreground/4 border-border', iconCls: 'text-muted-foreground/50',
            labelCls: 'text-muted-foreground', msgCls: '',
        },
    }[estado]
    const Icon = config.icon
    return (
        <div className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2.5', config.cls)}>
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconCls)} />
            <div className="min-w-0">
                <p className={cn('text-[12px] font-semibold leading-tight', config.labelCls)}>{config.label}</p>
                {config.msg && <p className={cn('mt-0.5 text-[11px]', config.msgCls)}>{config.msg}</p>}
            </div>
        </div>
    )
}

const MAX_PRODUTOS_VISIBLE = 8

function ProdutosRanking({ produtos }: { produtos: ProdutoRanking[] }) {
    if (produtos.length === 0) return null
    const visible = produtos.slice(0, MAX_PRODUTOS_VISIBLE)
    const hidden = produtos.length - MAX_PRODUTOS_VISIBLE
    const max = visible[0]?.quantidade ?? 1
    return (
        <div className="space-y-1">
            {visible.map(({ produto, quantidade }) => (
                <div key={produto} className="flex items-center gap-2">
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/6">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-primary/40" style={{ width: `${(quantidade / max) * 100}%` }} />
                    </div>
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground/70">{quantidade}</span>
                    <span className="w-36 truncate text-[11px] text-foreground/80">{produto}</span>
                </div>
            ))}
            {hidden > 0 && (
                <p className="pt-0.5 text-[10px] text-muted-foreground/40">+{hidden} produto{hidden > 1 ? 's' : ''}</p>
            )}
        </div>
    )
}

function SkeletonPerfil() {
    return (
        <div className="animate-pulse space-y-5">
            {[0, 1].map((s) => (
                <div key={s} className="space-y-1.5">
                    <div className="h-2 w-1/4 rounded-full bg-foreground/[0.07]" />
                    {[0.5, 0.4, 0.6].map((w, i) => (
                        <div key={i} className="flex justify-between">
                            <div className="h-2.5 rounded-full bg-foreground/5" style={{ width: `${w * 50}%` }} />
                            <div className="h-2.5 w-1/4 rounded-full bg-foreground/[0.04]" />
                        </div>
                    ))}
                </div>
            ))}
            <div className="h-14 rounded-xl bg-foreground/[0.04]" />
        </div>
    )
}

// ─── PerfilClienteRico ──────────────────────────────────────────────────────────

interface PerfilClienteRicoProps {
    contatoId: string
    nomeContato?: string
    /** Mostra a timeline de interações no fim (default true; false quando o pai já a tem). */
    showInteracoes?: boolean
}

export function PerfilClienteRico({ contatoId, nomeContato, showInteracoes = true }: PerfilClienteRicoProps) {
    const { contato, loading: contatoLoading } = useContato(contatoId)
    const { data: allContatoTags = [], isLoading: tagsLoading } = useContatoTags()
    const { data: allContatoCampanhas = [] } = useContatoCampanhas()
    const removerCampanha = useRemoverCampanha()
    const { data: ltv, isLoading: ltvLoading } = useLtvContato(contatoId)
    const { data: extras, isLoading: extrasLoading } = usePerfilExtras(contatoId)
    const { data: ritmo, isLoading: ritmoLoading } = useKanbanRowContato(contatoId)

    const isLoading = contatoLoading || tagsLoading || ltvLoading || extrasLoading || ritmoLoading

    if (isLoading) return <SkeletonPerfil />

    const appliedTags = allContatoTags.filter((ct) => ct.contato_id === contatoId).map((ct) => ct.tag)
    const campanhas = allContatoCampanhas.filter((cc) => cc.contato_id === contatoId)
    const handleWhatsApp = () => {
        const phone = (contato?.telefone ?? '').replace(/\D/g, '')
        if (phone) window.open(`https://wa.me/55${phone}`, '_blank')
    }

    return (
        <div className="space-y-5">
            {/* Identificação */}
            <div>
                <SectionLabel>Identificação</SectionLabel>
                <div className="space-y-0.5">
                    <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-semibold text-foreground leading-snug">
                            {contato?.nome ?? nomeContato ?? '–'}
                        </span>
                        {contato?.apelido && (
                            <span className="text-[11px] text-muted-foreground/60">({contato.apelido})</span>
                        )}
                    </div>
                    {(contato?.tipo || contato?.subtipo) && (
                        <p className="text-[11px] text-muted-foreground/60">
                            {[contato.tipo, contato.subtipo].filter(Boolean).join(' · ')}
                        </p>
                    )}
                    {contato?.telefone && (
                        <button
                            type="button"
                            onClick={handleWhatsApp}
                            className="mt-1 flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-[5px] text-[11px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                        >
                            <Phone className="h-3 w-3 shrink-0 text-primary/60" />
                            {formatPhone(contato.telefone)}
                        </button>
                    )}
                </div>
                {appliedTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {appliedTags.map((tag) => (
                            <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                                style={{ backgroundColor: tag.cor, color: textColorForBg(tag.cor) }}
                            >
                                {tag.nome}
                            </span>
                        ))}
                    </div>
                )}
                {campanhas.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {campanhas.slice(0, 4).map((c) => (
                            <span
                                key={c.campanha_id}
                                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-foreground"
                            >
                                <Megaphone className="h-3 w-3 shrink-0 text-primary/70" />
                                {c.nome}
                                <button
                                    type="button"
                                    onClick={() => removerCampanha.mutate({ contatoId, campanhaId: c.campanha_id })}
                                    className="ml-0.5 text-muted-foreground/50 transition-colors hover:text-destructive"
                                    aria-label={`Remover de ${c.nome}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                        {campanhas.length > 4 && (
                            <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                +{campanhas.length - 4}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Ritmo */}
            <div>
                <SectionLabel>Ritmo</SectionLabel>
                <div className="mb-2">
                    <TermometroCliente ritmo={ritmo} />
                </div>
                <div className="space-y-0.5">
                    <DataRow label="Dias sem compra" value={ritmo?.dias_sem_compra != null ? `${ritmo.dias_sem_compra} dias` : null} />
                    <DataRow label="Atraso" value={ritmo?.atraso != null && ritmo.atraso > 0 ? `${ritmo.atraso} dias` : null} />
                    <DataRow label="Próxima esperada" value={ritmo?.proxima_esperada ? formatDate(ritmo.proxima_esperada) : null} />
                </div>
            </div>

            {/* Financeiro */}
            <div>
                <SectionLabel>Financeiro</SectionLabel>
                <div className="space-y-0.5">
                    <DataRow label="LTV total" value={ltv?.ltv_total != null ? formatCurrency(Number(ltv.ltv_total)) : null} />
                    <DataRow label="Ticket médio" value={ltv?.ticket_medio != null ? formatCurrency(Number(ltv.ticket_medio)) : null} />
                    <DataRow label="Nº de compras" value={ltv?.total_pedidos != null ? `${ltv.total_pedidos} pedidos` : null} />
                </div>
            </div>

            {/* Fiado */}
            <div>
                <SectionLabel>Fiado</SectionLabel>
                <FiadoCard estado={extras?.fiado_estado ?? 'nunca_usou'} />
            </div>

            {/* Última compra */}
            <div>
                <SectionLabel>Última compra</SectionLabel>
                <div className="space-y-0.5">
                    <DataRow label="Produto" value={extras?.ultimo_produto ?? null} />
                    <DataRow label="Data" value={ritmo?.ultima_compra ? formatDate(ritmo.ultima_compra) : null} />
                </div>
            </div>

            {/* Produtos comprados */}
            {extras?.produtos && extras.produtos.length > 0 && (
                <div>
                    <SectionLabel>Produtos comprados</SectionLabel>
                    <ProdutosRanking produtos={extras.produtos} />
                </div>
            )}

            {/* Interações */}
            {showInteracoes && (
                <div>
                    <SectionLabel>Interações</SectionLabel>
                    <InteracoesTimeline contatoId={contatoId} />
                </div>
            )}
        </div>
    )
}
