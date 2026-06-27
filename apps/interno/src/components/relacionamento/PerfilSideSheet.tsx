import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Phone, AlertTriangle, CheckCircle, MinusCircle } from 'lucide-react'
import { cn, formatCurrency, formatDate, formatDateTime, formatPhone } from '@mont/shared'
import { Badge } from '../ui'
import { useContato } from '../../hooks/useContatos'
import { useContatoTags } from '../../hooks/useTags'
import { usePerfilExtras, useLtvContato } from '../../hooks/usePerfilSideSheet'
import { useInteracoes } from '../../hooks/useInteracoes'
import type { Canal } from '../../hooks/useInteracoes'
import { RegistrarContatoForm } from './RegistrarContatoForm'
import type { ProdutoRanking } from '../../services/relacionamentoService'
import type { KanbanRow, RelacionamentoStatus } from '../../hooks/useRelacionamento'

// ─── Config ───────────────────────────────────────────────────────────────────

const RESULTADO_LABEL: Record<string, string> = {
    a_contatar: 'A Contatar',
    contatado: 'Contatado',
    em_negociacao: 'Em Negociação',
    resolvido: 'Resolvido',
}

const STATUS_BADGE: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'default' | 'success'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    em_negociacao: 'default',
    resolvido: 'success',
}

const CANAL_OPTIONS: Array<{ value: Canal; label: string }> = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'google', label: 'Google' },
    { value: 'outro', label: 'Outro' },
]

const CANAL_BADGE_VARIANT: Record<Canal, 'success' | 'default' | 'warning' | 'secondary'> = {
    whatsapp: 'success',
    instagram: 'default',
    google: 'warning',
    outro: 'secondary',
}


const GRAIN_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

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

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
    return (
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.09em] text-muted-foreground/40">
            {children}
        </p>
    )
}

// ─── DataRow ──────────────────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-center justify-between gap-2 py-0.5">
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{label}</span>
            <span className="text-[12px] font-medium text-foreground text-right">
                {value ?? '–'}
            </span>
        </div>
    )
}

// ─── SkeletonPerfil ───────────────────────────────────────────────────────────

function SkeletonPerfil() {
    return (
        <div className="animate-pulse px-4 py-4 space-y-5">
            <div className="space-y-2">
                <div className="h-2 w-1/4 rounded-full bg-foreground/[0.07]" />
                <div className="h-3 w-2/3 rounded-full bg-foreground/[0.07]" />
                <div className="h-2.5 w-1/2 rounded-full bg-foreground/5" />
                <div className="flex gap-1.5 mt-1">
                    <div className="h-5 w-12 rounded-full bg-foreground/5" />
                    <div className="h-5 w-16 rounded-full bg-foreground/5" />
                </div>
            </div>
            <div className="space-y-1.5">
                <div className="h-2 w-1/5 rounded-full bg-foreground/[0.07]" />
                {[0.5, 0.4, 0.6].map((w, i) => (
                    <div key={i} className="flex justify-between">
                        <div className="h-2.5 rounded-full bg-foreground/5" style={{ width: `${w * 50}%` }} />
                        <div className="h-2.5 w-1/4 rounded-full bg-foreground/4" />
                    </div>
                ))}
            </div>
            <div className="space-y-1.5">
                <div className="h-2 w-1/4 rounded-full bg-foreground/[0.07]" />
                {[0.45, 0.5, 0.35].map((w, i) => (
                    <div key={i} className="flex justify-between">
                        <div className="h-2.5 rounded-full bg-foreground/5" style={{ width: `${w * 50}%` }} />
                        <div className="h-2.5 w-1/4 rounded-full bg-foreground/4" />
                    </div>
                ))}
            </div>
            <div className="h-14 rounded-xl bg-foreground/4" />
            <div className="space-y-1.5">
                <div className="h-2 w-1/4 rounded-full bg-foreground/[0.07]" />
                <div className="h-2.5 w-2/3 rounded-full bg-foreground/5" />
                <div className="h-2.5 w-1/3 rounded-full bg-foreground/4" />
            </div>
            <div className="space-y-1.5">
                <div className="h-2 w-1/3 rounded-full bg-foreground/[0.07]" />
                {[0.9, 0.6, 0.45, 0.3].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-foreground/5" style={{ width: `${w * 60}%` }} />
                        <div className="h-2.5 w-4 rounded-full bg-foreground/4" />
                        <div className="h-2.5 w-28 rounded-full bg-foreground/4" />
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── FiadoCard ────────────────────────────────────────────────────────────────

function FiadoCard({ estado }: { estado: 'em_aberto' | 'quitou' | 'nunca_usou' }) {
    const config = {
        em_aberto: {
            icon: AlertTriangle,
            label: 'Em aberto',
            msg: 'Não oferecer mais fiado',
            cls: 'bg-destructive/10 border-destructive/30',
            iconCls: 'text-destructive',
            labelCls: 'text-destructive',
            msgCls: 'text-destructive/80',
        },
        quitou: {
            icon: CheckCircle,
            label: 'Quitou',
            msg: 'Pode oferecer prazo',
            cls: 'bg-warning/10 border-warning/30',
            iconCls: 'text-warning',
            labelCls: 'text-warning',
            msgCls: 'text-warning/80',
        },
        nunca_usou: {
            icon: MinusCircle,
            label: 'Nunca usou fiado',
            msg: null,
            cls: 'bg-foreground/4 border-border',
            iconCls: 'text-muted-foreground/50',
            labelCls: 'text-muted-foreground',
            msgCls: '',
        },
    }[estado]

    const Icon = config.icon

    return (
        <div className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2.5', config.cls)}>
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconCls)} />
            <div className="min-w-0">
                <p className={cn('text-[12px] font-semibold leading-tight', config.labelCls)}>
                    {config.label}
                </p>
                {config.msg && (
                    <p className={cn('mt-0.5 text-[11px]', config.msgCls)}>{config.msg}</p>
                )}
            </div>
        </div>
    )
}

// ─── ProdutosRanking ──────────────────────────────────────────────────────────

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
                        <div
                            className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
                            style={{ width: `${(quantidade / max) * 100}%` }}
                        />
                    </div>
                    <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground/70">
                        {quantidade}
                    </span>
                    <span className="w-36 truncate text-[11px] text-foreground/80">{produto}</span>
                </div>
            ))}
            {hidden > 0 && (
                <p className="pt-0.5 text-[10px] text-muted-foreground/40">
                    +{hidden} produto{hidden > 1 ? 's' : ''}
                </p>
            )}
        </div>
    )
}

// ─── FeedbackItem ─────────────────────────────────────────────────────────────

function FeedbackItem({ canal, observacao, data }: { canal: string | null; observacao: string | null; data: string }) {
    const variant = canal ? (CANAL_BADGE_VARIANT[canal as Canal] ?? 'secondary') : 'secondary'
    const canalLabel = canal ? (CANAL_OPTIONS.find((o) => o.value === canal)?.label ?? canal) : null

    return (
        <div className="rounded-xl border border-border bg-foreground/2 px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
                {canalLabel && (
                    <Badge variant={variant} className="px-1.5 py-0 text-[10px]">
                        {canalLabel}
                    </Badge>
                )}
                <span className="text-[10.5px] text-muted-foreground/50">
                    {formatDateTime(data)}
                </span>
            </div>
            {observacao && (
                <p className="text-[12px] leading-[1.4] text-foreground/80 whitespace-pre-wrap wrap-break-word">
                    {observacao}
                </p>
            )}
        </div>
    )
}

// ─── PanelContent ─────────────────────────────────────────────────────────────

interface PanelContentProps {
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
    kanbanRow: KanbanRow
}

function PanelContent({ onClose, contatoId, nomeContato, statusAtual, kanbanRow }: PanelContentProps) {
    const [showPontoContato, setShowPontoContato] = useState(false)

    const { contato, loading: contatoLoading } = useContato(contatoId)
    const { data: allContatoTags = [], isLoading: tagsLoading } = useContatoTags()
    const { data: ltv, isLoading: ltvLoading } = useLtvContato(contatoId)
    const { data: extras, isLoading: extrasLoading } = usePerfilExtras(contatoId)
    const { data: interacoes, isLoading: interacoesLoading } = useInteracoes(contatoId)

    const feedbacks = (interacoes ?? []).filter((i) => i.tipo === 'feedback')

    const inicial = nomeContato.trim()[0]?.toUpperCase() ?? '?'
    const isLoading = contatoLoading || tagsLoading || ltvLoading || extrasLoading

    const appliedTags = allContatoTags
        .filter((ct) => ct.contato_id === contatoId)
        .map((ct) => ct.tag)

    const handleWhatsApp = () => {
        const phone = (contato?.telefone ?? '').replace(/\D/g, '')
        if (phone) window.open(`https://wa.me/55${phone}`, '_blank')
    }

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-card">
            {/* Grain overlay */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0"
                style={{ backgroundImage: GRAIN_BG, opacity: 0.04 }}
            />

            {/* Header */}
            <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-border px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[13px] font-bold text-primary">
                    {inicial}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-[1.35] text-foreground">
                        {nomeContato}
                    </p>
                    <div className="mt-0.5">
                        <Badge
                            variant={STATUS_BADGE[statusAtual]}
                            className="px-2 py-0 text-[10px]"
                        >
                            {RESULTADO_LABEL[statusAtual] ?? statusAtual}
                        </Badge>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {showPontoContato ? (
                <>
                    {/* Section label */}
                    <div className="relative z-10 shrink-0 border-b border-border px-4 py-2">
                        <p className="text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/50">
                            Registrar contato
                        </p>
                    </div>
                    {/* Form */}
                    <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
                        <RegistrarContatoForm
                            contatoId={contatoId}
                            onClose={() => setShowPontoContato(false)}
                        />
                    </div>
                </>
            ) : (
                <>
                    {/* Section label */}
                    <div className="relative z-10 shrink-0 border-b border-border px-4 py-2">
                        <p className="text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/50">
                            Perfil do cliente
                        </p>
                    </div>

                    {/* Body */}
                    <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
                        {isLoading ? (
                            <SkeletonPerfil />
                        ) : (
                            <div className="space-y-5 px-4 py-4">

                                {/* Identificação */}
                                <div>
                                    <SectionLabel>Identificação</SectionLabel>
                                    <div className="space-y-0.5">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[13px] font-semibold text-foreground leading-snug">
                                                {contato?.nome ?? nomeContato}
                                            </span>
                                            {contato?.apelido && (
                                                <span className="text-[11px] text-muted-foreground/60">
                                                    ({contato.apelido})
                                                </span>
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
                                                    style={{
                                                        backgroundColor: tag.cor,
                                                        color: textColorForBg(tag.cor),
                                                    }}
                                                >
                                                    {tag.nome}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Ritmo */}
                                <div>
                                    <SectionLabel>Ritmo</SectionLabel>
                                    <div className="space-y-0.5">
                                        <DataRow
                                            label="Dias sem compra"
                                            value={kanbanRow.dias_sem_compra != null ? `${kanbanRow.dias_sem_compra} dias` : null}
                                        />
                                        <DataRow
                                            label="Atraso"
                                            value={kanbanRow.atraso != null && kanbanRow.atraso > 0 ? `${kanbanRow.atraso} dias` : null}
                                        />
                                        <DataRow
                                            label="Próxima esperada"
                                            value={kanbanRow.proxima_esperada ? formatDate(kanbanRow.proxima_esperada) : null}
                                        />
                                    </div>
                                </div>

                                {/* Financeiro */}
                                <div>
                                    <SectionLabel>Financeiro</SectionLabel>
                                    <div className="space-y-0.5">
                                        <DataRow
                                            label="LTV total"
                                            value={ltv?.ltv_total != null ? formatCurrency(Number(ltv.ltv_total)) : null}
                                        />
                                        <DataRow
                                            label="Ticket médio"
                                            value={ltv?.ticket_medio != null ? formatCurrency(Number(ltv.ticket_medio)) : null}
                                        />
                                        <DataRow
                                            label="Nº de compras"
                                            value={ltv?.total_pedidos != null ? `${ltv.total_pedidos} pedidos` : null}
                                        />
                                    </div>
                                </div>

                                {/* Fiado */}
                                <div>
                                    <SectionLabel>Fiado</SectionLabel>
                                    {extras ? (
                                        <FiadoCard estado={extras.fiado_estado} />
                                    ) : (
                                        <FiadoCard estado="nunca_usou" />
                                    )}
                                </div>

                                {/* Última compra */}
                                <div>
                                    <SectionLabel>Última compra</SectionLabel>
                                    <div className="space-y-0.5">
                                        <DataRow
                                            label="Produto"
                                            value={extras?.ultimo_produto ?? null}
                                        />
                                        <DataRow
                                            label="Data"
                                            value={kanbanRow.ultima_compra ? formatDate(kanbanRow.ultima_compra) : null}
                                        />
                                    </div>
                                </div>

                                {/* Produtos comprados */}
                                {extras?.produtos && extras.produtos.length > 0 && (
                                    <div>
                                        <SectionLabel>Produtos comprados</SectionLabel>
                                        <ProdutosRanking produtos={extras.produtos} />
                                    </div>
                                )}

                                {/* Feedback */}
                                <div>
                                    <SectionLabel>Feedback</SectionLabel>
                                    {interacoesLoading ? (
                                        <div className="animate-pulse space-y-2">
                                            <div className="h-14 rounded-xl bg-foreground/4" />
                                            <div className="h-14 rounded-xl bg-foreground/4" />
                                        </div>
                                    ) : feedbacks.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground/40">
                                            Nenhum feedback registrado
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {feedbacks.map((fb) => (
                                                <FeedbackItem
                                                    key={fb.id}
                                                    canal={fb.canal}
                                                    observacao={fb.observacao}
                                                    data={fb.data}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>

                    {/* Sticky footer — registrar ponto de contato */}
                    <div className="relative z-10 shrink-0 border-t border-border px-4 py-3">
                        <button
                            type="button"
                            onClick={() => setShowPontoContato(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-foreground/4 px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                        >
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            Registrar contato
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

// ─── PerfilSideSheet ──────────────────────────────────────────────────────────

export interface PerfilSideSheetProps {
    isOpen: boolean
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
    kanbanRow: KanbanRow
}

export function PerfilSideSheet({ isOpen, onClose, ...rest }: PerfilSideSheetProps) {
    if (!isOpen) return null

    return createPortal(
        <aside className="fixed right-0 top-0 z-9999 h-screen w-80 animate-slide-in-right overflow-hidden border-l border-border shadow-modal">
            <PanelContent onClose={onClose} {...rest} />
        </aside>,
        document.body,
    )
}
