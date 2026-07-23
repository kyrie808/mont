import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
    DragOverlay,
    DndContext,
    PointerSensor,
    pointerWithin,
    type CollisionDetection,
    useDroppable,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HelpCircle, History, Loader2, MessageSquare, Phone, Tag, UserRound, X } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { cn } from '@mont/shared'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Badge, Tabs, TabsList, TabsTrigger, useToast } from '../components/ui'
import {
    useKanbanData,
    useMoverCard,
    type KanbanRow,
    type RelacionamentoAba,
    type RelacionamentoStatus,
} from '../hooks/useRelacionamento'
import { TimelineSideSheet } from '../components/relacionamento/TimelineSideSheet'
import { FeedbackSideSheet } from '../components/relacionamento/FeedbackSideSheet'
import { TagsSideSheet } from '../components/relacionamento/TagsSideSheet'
import { PerfilSideSheet } from '../components/relacionamento/PerfilSideSheet'
import { LinhaMotivo } from '../components/relacionamento/LinhaMotivo'
import { useContatoTags } from '../hooks/useTags'

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDS_PER_PAGE = 30

const ABAS: Array<{ value: RelacionamentoAba; label: string }> = [
    { value: 'leads', label: 'Leads' },
    { value: 'reativacao', label: 'Reativação' },
    { value: 'recompra', label: 'Recompra' },
    { value: 'cobranca', label: 'Cobrança' },
]

// Colunas = ciclo de vida do contato (cadência de follow-up; rótulos assistidos).
// contatado = "Aguardando resposta"; follow_up = toque vencido; sem_retorno = esgotou.
const COLUNAS: Array<{ status: RelacionamentoStatus; label: string }> = [
    { status: 'a_contatar', label: 'A Contatar' },
    { status: 'contatado', label: 'Aguardando Resposta' },
    { status: 'follow_up', label: 'Follow-up' },
    { status: 'em_negociacao', label: 'Em Conversa' },
    { status: 'resolvido', label: 'Resolvido' },
    { status: 'sem_retorno', label: 'Sem Retorno' },
]

// Coluna efetiva exposta pela view (deriva a cadência: contatado → follow_up/sem_retorno).
// Fallback defensivo para o status cru caso a view ainda não traga o campo.
function colunaEfetivaDe(card: KanbanRow): RelacionamentoStatus {
    return card.coluna_efetiva ?? card.status_relacionamento ?? 'a_contatar'
}

const BADGE_VARIANT: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'success' | 'default'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    follow_up: 'warning',
    em_negociacao: 'default',
    resolvido: 'success',
    sem_retorno: 'secondary',
}

const EMPTY_LIMITS: Record<RelacionamentoStatus, number> = {
    a_contatar: CARDS_PER_PAGE,
    contatado: CARDS_PER_PAGE,
    follow_up: CARDS_PER_PAGE,
    em_negociacao: CARDS_PER_PAGE,
    resolvido: CARDS_PER_PAGE,
    sem_retorno: CARDS_PER_PAGE,
}

interface TimelineTarget {
    contatoId: string
    nomeContato: string
    statusAtual: RelacionamentoStatus
}

interface PerfilTarget extends TimelineTarget {
    kanbanRow: KanbanRow
}

// ─── Card content (shared between SortableCard and OverlayCard) ───────────────

function CardBody({ card }: { card: KanbanRow & { contato_id: string } }) {
    const { data: allContatoTags = [] } = useContatoTags()
    const cardTags = allContatoTags
        .filter((ct) => ct.contato_id === card.contato_id)
        .map((ct) => ct.tag)

    const status = card.coluna_efetiva ?? card.status_relacionamento ?? 'a_contatar'
    const tentativas = card.tentativas ?? 0
    return (
        <>
            {status === 'follow_up' && (
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-warning-strong/30 bg-warning-strong/10 px-2 py-0.5 text-[10px] font-semibold text-warning-strong">
                    follow-up {Math.min(tentativas + 1, 5)}/5 · vencido
                </div>
            )}
            {status === 'sem_retorno' && (
                <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    sem retorno · {tentativas} toques
                </div>
            )}
            {cardTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                    {cardTags.map((tag) => (
                        <span
                            key={tag.id}
                            title={tag.nome}
                            className="h-[5px] w-8 rounded-sm"
                            style={{ backgroundColor: tag.cor }}
                        />
                    ))}
                </div>
            )}
            <p className="truncate text-[13px] font-semibold leading-[1.35] text-foreground">
                {card.nome ?? 'Sem nome'}
            </p>
            <div className="mt-0.5 mb-1 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <UserRound className="h-3 w-3 shrink-0 text-warning/70" />
                <span>ID: {card.contato_id.slice(0, 8)}</span>
            </div>
            <LinhaMotivo card={card} />
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2 py-[5px]">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-primary/60" />
                    <span className="truncate text-[11px] text-muted-foreground">
                        {card.telefone ?? 'Sem telefone'}
                    </span>
                </div>
                <Badge variant={BADGE_VARIANT[status]}>
                    {COLUNAS.find((c) => c.status === status)?.label ?? 'A Contatar'}
                </Badge>
            </div>
        </>
    )
}

// ─── ActionBar ────────────────────────────────────────────────────────────────

function ActionBar({
    onTimelineClick,
    onFeedbackClick,
    onTagsClick,
    onPerfilClick,
}: {
    onTimelineClick: () => void
    onFeedbackClick: () => void
    onTagsClick: () => void
    onPerfilClick: () => void
}) {
    return (
        <div
            className="mt-2 flex flex-col items-start gap-1 border-t border-border pt-2"
            // stopPropagation em pointerDown: impede que pressionar os botões
            // ative o drag do dnd-kit (cujos listeners ficam no div pai do card).
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                onClick={onTimelineClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <History className="h-3.5 w-3.5 shrink-0" />
                Linha do tempo
            </button>
            <button
                type="button"
                onClick={onFeedbackClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                Feedback
            </button>
            <button
                type="button"
                onClick={onTagsClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <Tag className="h-3.5 w-3.5 shrink-0" />
                Tags
            </button>
            <button
                type="button"
                onClick={onPerfilClick}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
                <UserRound className="h-3.5 w-3.5 shrink-0" />
                Perfil
            </button>
        </div>
    )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
// isDragging → ghost placeholder (dashed, transparent, preserves height)
// normal     → solid card with hover state

function SortableCard({
    card,
    showActions,
    onCardClick,
    onTimelineClick,
    onFeedbackClick,
    onTagsClick,
    onPerfilClick,
}: {
    card: KanbanRow & { contato_id: string }
    showActions: boolean
    onCardClick: () => void
    onTimelineClick: () => void
    onFeedbackClick: () => void
    onTagsClick: () => void
    onPerfilClick: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.contato_id,
    })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            {...attributes}
            {...listeners}
            onClick={(e) => {
                e.stopPropagation()
                onCardClick()
            }}
            className={cn(
                'rounded-xl border p-3 touch-none transition-[box-shadow,border-color,opacity]',
                isDragging
                    ? 'border-dashed border-border bg-transparent opacity-30 shadow-none'
                    : 'bg-card border-border shadow-[0_1px_3px_rgb(0_0_0/0.22)] cursor-grab hover:border-foreground/20 hover:shadow-[0_6px_20px_rgb(0_0_0/0.40)]'
            )}
        >
            <div className={isDragging ? 'invisible' : undefined}>
                <CardBody card={card} />
                {showActions && !isDragging && (
                    <ActionBar
                        onTimelineClick={onTimelineClick}
                        onFeedbackClick={onFeedbackClick}
                        onTagsClick={onTagsClick}
                        onPerfilClick={onPerfilClick}
                    />
                )}
            </div>
        </div>
    )
}

// ─── DroppableColuna ──────────────────────────────────────────────────────────
// Solid surface — NO backdrop-filter, blur, or gradient.
// isOver state signals the column is the active drop target.

function DroppableColuna({
    status,
    label,
    total,
    children,
}: {
    status: RelacionamentoStatus
    label: string
    total: number
    children: ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status })

    return (
        <div
            ref={setNodeRef}
            className={cn(
                // largura fixa no desktop (mantém as colunas confortáveis; o board rola na horizontal)
                'rounded-2xl border p-2.5 transition-[border-color,background,box-shadow] lg:w-80 lg:shrink-0',
                isOver
                    ? 'border-primary bg-primary/3 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]'
                    : 'border-border bg-muted'
            )}
        >
            {/* Column header */}
            <div className={cn(
                'mb-2.5 flex items-center justify-between border-b pb-2.5',
                isOver ? 'border-primary/20' : 'border-border'
            )}>
                <h2 className={cn(
                    'text-[10.5px] font-black uppercase tracking-[0.09em]',
                    isOver ? 'text-primary/80' : 'text-muted-foreground'
                )}>
                    {label}
                </h2>
                <span className={cn(
                    'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                    isOver
                        ? 'bg-primary/10 text-primary/70'
                        : 'bg-foreground/6 text-muted-foreground/70'
                )}>
                    {total}
                </span>
            </div>

            {children}
        </div>
    )
}

// ─── OverlayCard ──────────────────────────────────────────────────────────────
// Floating card that follows the cursor during drag.
// Rotation + scale give tactile "picked up" feel.
// Rendered via DragOverlay, which lives outside any backdrop-filter ancestor.

function OverlayCard({ card }: { card: KanbanRow & { contato_id: string } }) {
    return (
        <div className="rounded-xl border border-primary/30 bg-card p-3 shadow-[0_24px_64px_rgb(0_0_0/0.65),0_6px_20px_rgb(0_0_0/0.35)] rotate-[-1.2deg] scale-[1.03] cursor-grabbing">
            <CardBody card={card} />
        </div>
    )
}

// ─── Collision detection (preserved verbatim from prior fix) ──────────────────

const isStatusColuna = (id: string): id is RelacionamentoStatus =>
    COLUNAS.some((coluna) => coluna.status === id)

const collisionDetectionStrategy: CollisionDetection = (args) => {
    // Primary: pointer inside a column droppable — follows exact user intent
    const pointerCollisions = pointerWithin(args)
    const colunaCollision = pointerCollisions.find((collision) => isStatusColuna(String(collision.id)))
    if (colunaCollision) return [colunaCollision]

    // Fallback (pointer in column gap): find the column whose nearest horizontal
    // edge is closest to the pointer X. rectIntersection returns empty when the
    // pointer is fully outside all rects, so we measure edge distance instead.
    // Card droppables are excluded — only the 4 status columns are candidates.
    const { pointerCoordinates } = args
    const colunaContainers = args.droppableContainers.filter((c) => isStatusColuna(String(c.id)))

    if (!pointerCoordinates || colunaContainers.length === 0) return []

    let closestId: string | null = null
    let closestDist = Infinity
    for (const container of colunaContainers) {
        const rect = args.droppableRects.get(container.id)
        if (!rect) continue
        const distX =
            pointerCoordinates.x < rect.left
                ? rect.left - pointerCoordinates.x
                : pointerCoordinates.x > rect.right
                    ? pointerCoordinates.x - rect.right
                    : 0
        if (distX < closestDist) {
            closestDist = distX
            closestId = String(container.id)
        }
    }

    return closestId ? [{ id: closestId, data: {} }] : []
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Relacionamento() {
    const [searchParams, setSearchParams] = useSearchParams()
    const location = useLocation()
    const toast = useToast()

    // ── Aba logic (preserved) ─────────────────────────────────────────────────
    const abaInicial = useMemo<RelacionamentoAba>(() => {
        const abaQuery = searchParams.get('aba')
        if (abaQuery === 'leads' || abaQuery === 'reativacao' || abaQuery === 'recompra' || abaQuery === 'cobranca') {
            return abaQuery
        }
        const state = location.state as { aba?: RelacionamentoAba } | null
        if (state?.aba) return state.aba
        return 'reativacao'
    }, [location.state, searchParams])

    const [legendaAberta, setLegendaAberta] = useState(false)
    const [activeCardId, setActiveCardId] = useState<string | null>(null)
    const [actionCardId, setActionCardId] = useState<string | null>(null)
    const [timelineTarget, setTimelineTarget] = useState<TimelineTarget | null>(null)
    const [feedbackTarget, setFeedbackTarget] = useState<TimelineTarget | null>(null)
    const [tagsTarget, setTagsTarget] = useState<TimelineTarget | null>(null)
    const [perfilTarget, setPerfilTarget] = useState<PerfilTarget | null>(null)
    const dragHappenedRef = useRef(false)

    // Per-column visible card limit — resets on tab change.
    const [visibleLimits, setVisibleLimits] = useState<Record<RelacionamentoStatus, number>>(EMPTY_LIMITS)

    const { data = [], isLoading, error } = useKanbanData(abaInicial)
    const moverCard = useMoverCard()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    )

    // ── Derived data (preserved) ──────────────────────────────────────────────
    const colunas = useMemo(() => {
        return COLUNAS.map((coluna) => {
            const cards = data.filter(
                (item): item is KanbanRow & { contato_id: string } =>
                    colunaEfetivaDe(item) === coluna.status && typeof item.contato_id === 'string'
            )
            // Follow-up: mais tentativas (mais perto de esgotar) no topo — fila de triagem.
            if (coluna.status === 'follow_up') {
                cards.sort((a, b) => (b.tentativas ?? 0) - (a.tentativas ?? 0))
            }
            return { ...coluna, cards }
        })
    }, [data])

    // Mapa contato → coluna EFETIVA (o que o usuário vê): base do drag e do no-op check.
    const cardStatusMap = useMemo(() => {
        const map = new Map<string, RelacionamentoStatus>()
        for (const card of data) {
            if (card.contato_id) {
                map.set(card.contato_id, colunaEfetivaDe(card))
            }
        }
        return map
    }, [data])

    // ── Handlers (preserved) ──────────────────────────────────────────────────
    const handleTrocarAba = (value: string) => {
        const novaAba = value as RelacionamentoAba
        setSearchParams({ aba: novaAba })
        setVisibleLimits(EMPTY_LIMITS)
        setActionCardId(null)
        setTimelineTarget(null)
        setFeedbackTarget(null)
        setTagsTarget(null)
        setPerfilTarget(null)
    }

    const handleDragStart = (event: DragStartEvent) => {
        setActiveCardId(String(event.active.id))
        dragHappenedRef.current = true
        setActionCardId(null)
    }

    const handleDragCancel = () => {
        setActiveCardId(null)
        setTimeout(() => { dragHappenedRef.current = false }, 0)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) return

        const contatoId = String(active.id)
        const statusAtual = cardStatusMap.get(contatoId)

        const overId = String(over.id)
        const novoStatus = (COLUNAS.some((c) => c.status === overId)
            ? overId
            : cardStatusMap.get(overId)) as RelacionamentoStatus | undefined

        if (!novoStatus) return
        if (!statusAtual || statusAtual === novoStatus) return

        try {
            await moverCard.mutateAsync({
                contatoId,
                novoStatus,
                observacao: `Movido de ${statusAtual} para ${novoStatus} via drag-and-drop`,
            })
            toast.success('Card movido com sucesso')
        } catch (mutationError) {
            const message = mutationError instanceof Error ? mutationError.message : 'Erro ao mover card'
            toast.error(message)
        }
    }

    const handleCardClick = (card: KanbanRow & { contato_id: string }) => {
        if (dragHappenedRef.current) return
        setActionCardId((prev) => (prev === card.contato_id ? null : card.contato_id))
    }

    const handleOpenTimeline = (card: KanbanRow & { contato_id: string }) => {
        setActionCardId(null)
        setFeedbackTarget(null)
        setTagsTarget(null)
        setPerfilTarget(null)
        setTimelineTarget({
            contatoId: card.contato_id,
            nomeContato: card.nome ?? 'Sem nome',
            statusAtual: colunaEfetivaDe(card),
        })
    }

    const handleOpenFeedback = (card: KanbanRow & { contato_id: string }) => {
        setActionCardId(null)
        setTimelineTarget(null)
        setTagsTarget(null)
        setPerfilTarget(null)
        setFeedbackTarget({
            contatoId: card.contato_id,
            nomeContato: card.nome ?? 'Sem nome',
            statusAtual: colunaEfetivaDe(card),
        })
    }

    const handleOpenTags = (card: KanbanRow & { contato_id: string }) => {
        setActionCardId(null)
        setTimelineTarget(null)
        setFeedbackTarget(null)
        setPerfilTarget(null)
        setTagsTarget({
            contatoId: card.contato_id,
            nomeContato: card.nome ?? 'Sem nome',
            statusAtual: colunaEfetivaDe(card),
        })
    }

    const handleOpenPerfil = (card: KanbanRow & { contato_id: string }) => {
        setActionCardId(null)
        setTimelineTarget(null)
        setFeedbackTarget(null)
        setTagsTarget(null)
        setPerfilTarget({
            contatoId: card.contato_id,
            nomeContato: card.nome ?? 'Sem nome',
            statusAtual: colunaEfetivaDe(card),
            kanbanRow: card,
        })
    }

    const activeCard = useMemo(() => {
        if (!activeCardId) return null
        return data.find(
            (item): item is KanbanRow & { contato_id: string } =>
                typeof item.contato_id === 'string' && item.contato_id === activeCardId
        ) ?? null
    }, [activeCardId, data])

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <Header
                title="Relacionamento"
                showBack
                centerTitle
                transparent
                rightAction={
                    <button
                        type="button"
                        aria-label="Legenda do kanban"
                        onClick={() => setLegendaAberta(true)}
                        className="flex size-9 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <HelpCircle className="h-5 w-5" />
                    </button>
                }
            />

            {/*
                PageContainer: sem backdrop-filter, blur, nem gradiente neste nível
                ou em qualquer ancestral do DndContext.
                Isso garante que position:fixed do DragOverlay seja relativo ao
                viewport, não a um containing block quebrado.
            */}
            <PageContainer className="pt-4 pb-24 px-4">
                <div className="space-y-4">

                    {/* Tabs — usa o estilo padrão do design system */}
                    <Tabs value={abaInicial} onValueChange={handleTrocarAba}>
                        <TabsList>
                            {ABAS.map((aba) => (
                                <TabsTrigger key={aba.value} value={aba.value}>
                                    {aba.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    {/* Loading */}
                    {isLoading && (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Carregando...
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                            {error instanceof Error ? error.message : 'Erro ao carregar dados'}
                        </div>
                    )}

                    {/* Board */}
                    {!isLoading && !error && (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={collisionDetectionStrategy}
                            onDragStart={handleDragStart}
                            onDragCancel={handleDragCancel}
                            onDragEnd={(event) => {
                                setActiveCardId(null)
                                void handleDragEnd(event)
                                setTimeout(() => { dragHappenedRef.current = false }, 0)
                            }}
                        >
                            <div
                                // mobile: empilha (1 col). desktop: linha com scroll horizontal (Trello-like).
                                className="flex flex-col gap-3.5 lg:flex-row lg:items-start lg:overflow-x-auto lg:pb-3"
                                onClick={() => setActionCardId(null)}
                            >
                                {colunas.map((coluna) => {
                                    const limit = visibleLimits[coluna.status]
                                    const visibleCards = coluna.cards.slice(0, limit)
                                    const remaining = coluna.cards.length - visibleCards.length

                                    return (
                                        <DroppableColuna
                                            key={coluna.status}
                                            status={coluna.status}
                                            label={coluna.label}
                                            total={coluna.cards.length}
                                        >
                                            <SortableContext
                                                items={visibleCards.map((c) => c.contato_id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-2 min-h-20">
                                                    {visibleCards.map((card) => (
                                                        <SortableCard
                                                            key={card.contato_id}
                                                            card={card}
                                                            showActions={actionCardId === card.contato_id}
                                                            onCardClick={() => handleCardClick(card)}
                                                            onTimelineClick={() => handleOpenTimeline(card)}
                                                            onFeedbackClick={() => handleOpenFeedback(card)}
                                                            onTagsClick={() => handleOpenTags(card)}
                                                            onPerfilClick={() => handleOpenPerfil(card)}
                                                        />
                                                    ))}

                                                    {coluna.cards.length === 0 && (
                                                        <div className="rounded-xl border border-dashed border-border py-7 text-center text-[11px] text-muted-foreground/60">
                                                            Nenhum cliente
                                                        </div>
                                                    )}
                                                </div>
                                            </SortableContext>

                                            {remaining > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setVisibleLimits((prev) => ({
                                                            ...prev,
                                                            [coluna.status]: prev[coluna.status] + CARDS_PER_PAGE,
                                                        }))
                                                    }
                                                    className="mt-2 w-full rounded-xl border border-border py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                                                >
                                                    Carregar mais &middot;{' '}
                                                    <span className="text-warning">+{remaining}</span>
                                                </button>
                                            )}
                                        </DroppableColuna>
                                    )
                                })}
                            </div>

                            <DragOverlay dropAnimation={null}>
                                {activeCard ? <OverlayCard card={activeCard} /> : null}
                            </DragOverlay>
                        </DndContext>
                    )}

                </div>
            </PageContainer>

            {timelineTarget && (
                <TimelineSideSheet
                    isOpen
                    onClose={() => setTimelineTarget(null)}
                    contatoId={timelineTarget.contatoId}
                    nomeContato={timelineTarget.nomeContato}
                    statusAtual={timelineTarget.statusAtual}
                />
            )}

            {feedbackTarget && (
                <FeedbackSideSheet
                    isOpen
                    onClose={() => setFeedbackTarget(null)}
                    contatoId={feedbackTarget.contatoId}
                    nomeContato={feedbackTarget.nomeContato}
                    statusAtual={feedbackTarget.statusAtual}
                />
            )}

            {tagsTarget && (
                <TagsSideSheet
                    isOpen
                    onClose={() => setTagsTarget(null)}
                    contatoId={tagsTarget.contatoId}
                    nomeContato={tagsTarget.nomeContato}
                    statusAtual={tagsTarget.statusAtual}
                />
            )}

            {perfilTarget && (
                <PerfilSideSheet
                    isOpen
                    onClose={() => setPerfilTarget(null)}
                    contatoId={perfilTarget.contatoId}
                    nomeContato={perfilTarget.nomeContato}
                    statusAtual={perfilTarget.statusAtual}
                />
            )}

            {legendaAberta && (
                <div
                    className="fixed inset-0 z-overlay flex items-end bg-black/60 backdrop-blur-xs"
                    onClick={() => setLegendaAberta(false)}
                >
                    <div
                        className="max-h-[82vh] w-full overflow-y-auto rounded-t-2xl border border-border border-b-0 bg-card p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-[15px] font-bold text-foreground">Como funciona o Kanban</h2>
                            <button
                                type="button"
                                aria-label="Fechar legenda"
                                onClick={() => setLegendaAberta(false)}
                                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-5 text-[12.5px] leading-[1.6]">
                            <section>
                                <h3 className="mb-2 text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/70">Abas</h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-semibold text-foreground">Recompra</p>
                                        <p className="text-muted-foreground">Clientes que já compram com você. Cuide do ritmo — ofereça no momento certo, antes que eles busquem outra opção. Os mais atrasados ficam no topo.</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">Reativação</p>
                                        <p className="text-muted-foreground">Compraram 1 vez e não voltaram. O balde esvaziou. O objetivo é a 2ª venda — chamar, perguntar se gostou, fazer a oferta certa.</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-foreground">Cobrança</p>
                                        <p className="text-muted-foreground">Têm fiado em aberto. Resolva isso antes de qualquer ação comercial.</p>
                                    </div>
                                </div>
                            </section>

                            <div className="border-t border-border" />

                            <section>
                                <h3 className="mb-2 text-[10.5px] font-black uppercase tracking-[0.09em] text-muted-foreground/70">Termos do card</h3>
                                <div className="space-y-2">
                                    <p><span className="font-semibold text-foreground">balde cheio</span><span className="text-muted-foreground"> — comprou há pouco, o produto provavelmente ainda está em casa. Sem pressa.</span></p>
                                    <p><span className="font-semibold text-foreground">balde vazio</span><span className="text-muted-foreground"> — passou do prazo de consumo sem 2ª compra. Hora de chamar.</span></p>
                                    <p><span className="font-semibold text-foreground">no ritmo</span><span className="text-muted-foreground"> — dentro do intervalo normal desse cliente. Sem urgência.</span></p>
                                    <p><span className="font-semibold text-foreground">atrasou Xd</span><span className="text-muted-foreground"> — X dias além do esperado. Bom momento para oferecer.</span></p>
                                    <p><span className="font-semibold text-foreground">sumiu</span><span className="text-muted-foreground"> — muito além do ciclo esperado. O cliente esfriou. Vale chamar hoje.</span></p>
                                    <p><span className="font-semibold text-foreground">compra a cada ~Xd</span><span className="text-muted-foreground"> — intervalo médio entre as compras desse cliente (calculado pelo histórico dele, não um valor global).</span></p>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
