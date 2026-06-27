import { useState } from 'react'
import { ArrowRightLeft, MessageSquare, Tag, PhoneCall, Pencil } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@mont/shared'
import { Modal } from '../ui'
import { useInteracoes, type Interacao } from '../../hooks/useInteracoes'
import { RegistrarContatoForm } from './RegistrarContatoForm'

// ─── Config ───────────────────────────────────────────────────────────────────

const RESULTADO_LABEL: Record<string, string> = {
    a_contatar: 'A Contatar',
    contatado: 'Contatado',
    em_negociacao: 'Em Negociação',
    resolvido: 'Resolvido',
}

interface TipoConfig {
    icon: LucideIcon
    dotBg: string
    dotBorder: string
    iconColor: string
}

const TIPO_CONFIG: Record<string, TipoConfig> = {
    movimentacao_kanban: { icon: ArrowRightLeft, dotBg: 'bg-primary/10', dotBorder: 'border-primary/25', iconColor: 'text-primary' },
    feedback: { icon: MessageSquare, dotBg: 'bg-warning/10', dotBorder: 'border-warning/25', iconColor: 'text-warning' },
    tag: { icon: Tag, dotBg: 'bg-blue-400/10', dotBorder: 'border-blue-400/25', iconColor: 'text-blue-400' },
    ponto_contato: { icon: PhoneCall, dotBg: 'bg-emerald-400/10', dotBorder: 'border-emerald-400/25', iconColor: 'text-emerald-400' },
}

const TIPO_CONFIG_DEFAULT: TipoConfig = {
    icon: MessageSquare,
    dotBg: 'bg-foreground/5',
    dotBorder: 'border-border',
    iconColor: 'text-muted-foreground',
}

const CANAL_LABEL: Record<string, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    google: 'Google',
    outro: 'Outro',
}

const RESULTADO_PONTO_CONTATO_LABEL: Record<string, string> = {
    respondeu: 'Respondeu',
    sem_resposta: 'Sem resposta',
    aceitou: 'Aceitou',
    recusou: 'Recusou',
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
    const d = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
    const t = date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
    return `${d} · ${t}`
}

function getEventTitle(item: Interacao): string {
    if (item.tipo === 'movimentacao_kanban') {
        const label = item.resultado ? (RESULTADO_LABEL[item.resultado] ?? item.resultado) : '?'
        return `Movido para ${label}`
    }
    if (item.tipo === 'feedback') {
        const canalLabel = item.canal ? (CANAL_LABEL[item.canal] ?? item.canal) : null
        return canalLabel ? `Feedback · ${canalLabel}` : 'Feedback'
    }
    if (item.tipo === 'ponto_contato') {
        const canalLabel = item.canal ? (CANAL_LABEL[item.canal] ?? item.canal) : null
        const resultadoLabel = item.resultado ? (RESULTADO_PONTO_CONTATO_LABEL[item.resultado] ?? item.resultado) : null
        const parts = ['Contato', canalLabel, resultadoLabel].filter(Boolean)
        return parts.join(' · ')
    }
    return item.tipo ?? 'Interação'
}

// ─── SkeletonTimeline ─────────────────────────────────────────────────────────

function SkeletonTimeline() {
    return (
        <div className="animate-pulse px-4 py-4">
            {([0.75, 0.55, 0.65, 0.5] as const).map((w, i) => (
                <div key={i} className="relative flex gap-3 pb-5">
                    <div className="flex w-7 shrink-0 flex-col items-center">
                        <div className="h-7 w-7 rounded-full bg-foreground/[0.07]" />
                        {i < 3 && <div className="mt-1 w-px flex-1 bg-foreground/4" />}
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 rounded-full bg-foreground/[0.07]" style={{ width: `${w * 100}%` }} />
                        <div className="h-2.5 w-1/2 rounded-full bg-foreground/5" />
                        <div className="h-2 w-1/3 rounded-full bg-foreground/4" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── TimelineItem ─────────────────────────────────────────────────────────────

function TimelineItem({ item, isLast, onEdit }: { item: Interacao; isLast: boolean; onEdit?: (item: Interacao) => void }) {
    const config = (item.tipo ? TIPO_CONFIG[item.tipo] : null) ?? TIPO_CONFIG_DEFAULT
    const Icon = config.icon
    const relativo = formatRelativo(item.data)
    const absoluto = formatAbsoluto(item.data)
    const title = getEventTitle(item)
    const editable = item.tipo === 'ponto_contato' && !!onEdit

    const content = (
        <>
            <p className="text-[13px] font-semibold leading-[1.35] text-foreground">{title}</p>
            {item.observacao && (
                <p className={cn(
                    'mt-0.5 text-[11px] leading-[1.4] text-muted-foreground/70',
                    item.tipo === 'feedback' ? 'whitespace-pre-wrap wrap-break-word' : 'truncate',
                )}>
                    {item.observacao}
                </p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5">
                {relativo && (
                    <>
                        <span className="text-[10.5px] font-medium text-primary/70">{relativo}</span>
                        <span className="text-[10.5px] text-muted-foreground/30">·</span>
                    </>
                )}
                <span className="text-[10.5px] text-muted-foreground/60">{absoluto}</span>
                {editable && <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 ml-0.5" />}
            </div>
        </>
    )

    return (
        <div className="relative flex gap-3 pb-5">
            {/* Marker */}
            <div className="flex w-7 shrink-0 flex-col items-center">
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border', config.dotBg, config.dotBorder)}>
                    <Icon className={cn('h-[11px] w-[11px]', config.iconColor)} />
                </div>
                {!isLast && <div className="mt-1 w-px flex-1 bg-linear-to-b from-foreground/9 to-transparent" />}
            </div>

            {/* Content */}
            {editable ? (
                <button
                    type="button"
                    onClick={() => onEdit!(item)}
                    className="min-w-0 flex-1 pb-1 pt-[3px] text-left -mx-1 px-1 rounded-md hover:bg-foreground/3 transition-colors"
                    title="Editar contato"
                >
                    {content}
                </button>
            ) : (
                <div className="min-w-0 flex-1 pb-1 pt-[3px]">{content}</div>
            )}
        </div>
    )
}

// ─── InteracoesTimeline ───────────────────────────────────────────────────────
// Lista de interações de um contato (skeleton/erro/vazio/lista). Reutilizada no
// side-sheet do kanban (TimelineSideSheet) e no perfil do cliente (ContatoDetalhe).

export function InteracoesTimeline({ contatoId }: { contatoId: string }) {
    const { data: interacoes, isLoading, error } = useInteracoes(contatoId)
    const [editing, setEditing] = useState<Interacao | null>(null)

    if (isLoading) return <SkeletonTimeline />

    if (error) {
        return (
            <div className="mx-4 mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-[12px] font-semibold text-destructive-foreground">Erro ao carregar</p>
                <p className="mt-0.5 text-[11px] text-destructive-foreground/70">
                    {error instanceof Error ? error.message : 'Erro desconhecido'}
                </p>
            </div>
        )
    }

    if (!interacoes || interacoes.length === 0) {
        return (
            <div className="mx-4 mt-4 rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-[12px] text-muted-foreground/60">Nenhuma interação registrada</p>
            </div>
        )
    }

    return (
        <>
            <div className="px-4 py-4">
                {interacoes.map((item, idx) => (
                    <TimelineItem
                        key={item.id}
                        item={item}
                        isLast={idx === interacoes.length - 1}
                        onEdit={setEditing}
                    />
                ))}
            </div>

            <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar contato" size="sm">
                {editing && (
                    <RegistrarContatoForm
                        contatoId={contatoId}
                        interacao={editing}
                        onClose={() => setEditing(null)}
                    />
                )}
            </Modal>
        </>
    )
}
