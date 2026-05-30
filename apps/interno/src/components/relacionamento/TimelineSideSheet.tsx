import { createPortal } from 'react-dom'
import { X, ArrowRightLeft, MessageSquare, Tag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'
import { Badge } from '../ui'
import { useInteracoes, type Interacao } from '../../hooks/useInteracoes'
import type { RelacionamentoStatus } from '../../hooks/useRelacionamento'

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

interface TipoConfig {
    icon: LucideIcon
    dotBg: string
    dotBorder: string
    iconColor: string
}

const TIPO_CONFIG: Record<string, TipoConfig> = {
    movimentacao_kanban: {
        icon: ArrowRightLeft,
        dotBg: 'bg-primary/10',
        dotBorder: 'border-primary/25',
        iconColor: 'text-primary',
    },
    feedback: {
        icon: MessageSquare,
        dotBg: 'bg-warning/10',
        dotBorder: 'border-warning/25',
        iconColor: 'text-warning',
    },
    tag: {
        icon: Tag,
        dotBg: 'bg-blue-400/10',
        dotBorder: 'border-blue-400/25',
        iconColor: 'text-blue-400',
    },
}

const TIPO_CONFIG_DEFAULT: TipoConfig = {
    icon: MessageSquare,
    dotBg: 'bg-white/[0.05]',
    dotBorder: 'border-white/10',
    iconColor: 'text-muted-foreground',
}

const CANAL_LABEL: Record<string, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    google: 'Google',
    outro: 'Outro',
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativo(dateStr: string): string | null {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days = Math.floor(diff / 86_400_000)
    if (min < 1) return 'agora'
    if (min < 60) return `há ${min} min`
    if (hours < 24) return `há ${hours}h`
    if (days === 1) return 'ontem'
    if (days < 7) return `há ${days} dias`
    return null
}

function formatAbsoluto(dateStr: string): string {
    const date = new Date(dateStr)
    const d = date.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
    })
    const t = date.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
    })
    return `${d} · ${t}`
}

function getEventTitle(item: Interacao): string {
    if (item.tipo === 'movimentacao_kanban') {
        const label = item.resultado
            ? (RESULTADO_LABEL[item.resultado] ?? item.resultado)
            : '?'
        return `Movido para ${label}`
    }
    if (item.tipo === 'feedback') {
        const canalLabel = item.canal ? (CANAL_LABEL[item.canal] ?? item.canal) : null
        return canalLabel ? `Feedback · ${canalLabel}` : 'Feedback'
    }
    return item.tipo ?? 'Interação'
}

// ─── Grain SVG data URI (fractalNoise, sem blur, apenas textura) ──────────────

const GRAIN_BG =
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`

// ─── SkeletonTimeline ─────────────────────────────────────────────────────────

function SkeletonTimeline() {
    return (
        <div className="animate-pulse px-4 py-4">
            {([0.75, 0.55, 0.65, 0.5] as const).map((w, i) => (
                <div key={i} className="relative flex gap-3 pb-5">
                    <div className="flex w-7 shrink-0 flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-white/[0.07]" />
                        {i < 3 && <div className="mt-1 w-px flex-1 bg-white/[0.04]" />}
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 rounded-full bg-white/[0.07]" style={{ width: `${w * 100}%` }} />
                        <div className="h-2.5 w-1/2 rounded-full bg-white/[0.05]" />
                        <div className="h-2 w-1/3 rounded-full bg-white/[0.04]" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── TimelineItem ─────────────────────────────────────────────────────────────

function TimelineItem({ item, isLast }: { item: Interacao; isLast: boolean }) {
    const config = (item.tipo ? TIPO_CONFIG[item.tipo] : null) ?? TIPO_CONFIG_DEFAULT
    const Icon = config.icon
    const relativo = formatRelativo(item.data)
    const absoluto = formatAbsoluto(item.data)
    const title = getEventTitle(item)

    return (
        <div className="relative flex gap-3 pb-5">
            {/* Marker */}
            <div className="flex w-7 shrink-0 flex-col items-center">
                <div
                    className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                        config.dotBg,
                        config.dotBorder,
                    )}
                >
                    <Icon className={cn('h-[11px] w-[11px]', config.iconColor)} />
                </div>
                {!isLast && (
                    <div className="mt-1 w-px flex-1 bg-gradient-to-b from-white/[0.09] to-transparent" />
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pb-1 pt-[3px]">
                <p className="text-[13px] font-semibold leading-[1.35] text-foreground">
                    {title}
                </p>
                {item.observacao && (
                    <p className={cn(
                        'mt-0.5 text-[11px] leading-[1.4] text-muted-foreground/70',
                        item.tipo === 'feedback' ? 'whitespace-pre-wrap break-words' : 'truncate',
                    )}>
                        {item.observacao}
                    </p>
                )}
                <div className="mt-1.5 flex items-center gap-1.5">
                    {relativo && (
                        <>
                            <span className="text-[10.5px] font-medium text-primary/70">
                                {relativo}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground/30">·</span>
                        </>
                    )}
                    <span className="text-[10.5px] text-muted-foreground/60">{absoluto}</span>
                </div>
            </div>
        </div>
    )
}

// ─── PanelContent ─────────────────────────────────────────────────────────────

interface PanelContentProps {
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

function PanelContent({ onClose, contatoId, nomeContato, statusAtual }: PanelContentProps) {
    const { data: interacoes, isLoading, error } = useInteracoes(contatoId)
    const inicial = nomeContato.trim()[0]?.toUpperCase() ?? '?'

    return (
        <div className="relative flex h-full flex-col overflow-hidden bg-card">
            {/* Grain overlay — fundo sólido + textura, sem blur */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-0"
                style={{ backgroundImage: GRAIN_BG, opacity: 0.04 }}
            />

            {/* Header */}
            <div className="relative z-10 flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Section label */}
            <div className="relative z-10 shrink-0 border-b border-white/[0.04] px-4 py-2">
                <p className="text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/50">
                    Histórico de interações
                </p>
            </div>

            {/* Body */}
            <div className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
                {isLoading && <SkeletonTimeline />}

                {error && (
                    <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                        <p className="text-[12px] font-semibold text-destructive-foreground">
                            Erro ao carregar
                        </p>
                        <p className="mt-0.5 text-[11px] text-destructive-foreground/70">
                            {error instanceof Error ? error.message : 'Erro desconhecido'}
                        </p>
                    </div>
                )}

                {!isLoading && !error && interacoes?.length === 0 && (
                    <div className="mx-4 mt-4 rounded-xl border border-dashed border-white/[0.07] py-8 text-center">
                        <p className="text-[12px] text-muted-foreground/60">
                            Nenhuma interação registrada
                        </p>
                    </div>
                )}

                {!isLoading && !error && interacoes && interacoes.length > 0 && (
                    <div className="px-4 py-4">
                        {interacoes.map((item, idx) => (
                            <TimelineItem
                                key={item.id}
                                item={item}
                                isLast={idx === interacoes.length - 1}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── TimelineSideSheet ────────────────────────────────────────────────────────

export interface TimelineSideSheetProps {
    isOpen: boolean
    onClose: () => void
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

export function TimelineSideSheet({ isOpen, onClose, ...rest }: TimelineSideSheetProps) {
    if (!isOpen) return null

    return createPortal(
        <aside className="fixed right-0 top-0 z-[9999] h-screen w-80 animate-slide-in-right overflow-hidden border-l border-white/[0.07] shadow-modal">
            <PanelContent onClose={onClose} {...rest} />
        </aside>,
        document.body,
    )
}
