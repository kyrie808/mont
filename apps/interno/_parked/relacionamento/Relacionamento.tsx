import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
    DragOverlay,
    DndContext,
    PointerSensor,
    closestCenter,
    pointerWithin,
    type CollisionDetection,
    type DragCancelEvent,
    useDroppable,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, UserRound, Loader2 } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Badge, Card, CardContent, Tabs, TabsList, TabsTrigger, useToast } from '../components/ui'
import {
    useKanbanData,
    useMoverCard,
    type KanbanRow,
    type RelacionamentoAba,
    type RelacionamentoStatus,
} from '../hooks/useRelacionamento'

const ABAS: Array<{ value: RelacionamentoAba; label: string }> = [
    { value: 'reativacao', label: 'Reativacao' },
    { value: 'recompra', label: 'Recompra' },
    { value: 'cobranca', label: 'Cobranca' },
]

const COLUNAS: Array<{ status: RelacionamentoStatus; label: string }> = [
    { status: 'a_contatar', label: 'A Contatar' },
    { status: 'contatado', label: 'Contatado' },
    { status: 'em_negociacao', label: 'Em Negociacao' },
    { status: 'resolvido', label: 'Resolvido' },
]

const BADGE_VARIANT: Record<RelacionamentoStatus, 'warning' | 'secondary' | 'success' | 'default'> = {
    a_contatar: 'warning',
    contatado: 'secondary',
    em_negociacao: 'default',
    resolvido: 'success',
}

function SortableCard({ card }: { card: KanbanRow & { contato_id: string } }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: card.contato_id,
    })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const status = card.status_relacionamento ?? 'a_contatar'

    return (
        <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative rounded-2xl border border-emerald-500/20 bg-zinc-950/80 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.6)] touch-none"
        >
            <CardContent className={`p-3 ${isDragging ? 'opacity-70' : ''}`}>
                <div className="mb-3 space-y-1">
                    <p className="text-[15px] font-semibold leading-5 text-zinc-100">
                        {card.nome ?? 'Sem nome'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <UserRound className="h-3.5 w-3.5 text-amber-300" />
                        <span>ID: {card.contato_id.slice(0, 8)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-300">
                    <div className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="truncate">{card.telefone ?? 'Sem telefone'}</span>
                    </div>
                    <Badge variant={BADGE_VARIANT[status]} className="border-none bg-amber-400/15 text-amber-200">
                        {COLUNAS.find((c) => c.status === status)?.label ?? 'A Contatar'}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    )
}

function DroppableColuna({
    status,
    children,
}: {
    status: RelacionamentoStatus
    children: ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status })

    return (
        <div
            ref={setNodeRef}
            className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition ${isOver ? 'ring-4 ring-emerald-400 bg-emerald-400/5' : ''}`}
        >
            {children}
        </div>
    )
}

function OverlayCard({ card }: { card: KanbanRow & { contato_id: string } }) {
    const status = card.status_relacionamento ?? 'a_contatar'

    return (
        <Card className="relative rounded-2xl border border-emerald-400/50 bg-zinc-950/90 shadow-2xl scale-[1.02]">
            <CardContent className="p-3">
                <div className="mb-3 space-y-1">
                    <p className="text-[15px] font-semibold leading-5 text-zinc-100">{card.nome ?? 'Sem nome'}</p>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <UserRound className="h-3.5 w-3.5 text-amber-300" />
                        <span>ID: {card.contato_id.slice(0, 8)}</span>
                    </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-zinc-300">
                    <div className="flex items-center gap-1.5 truncate">
                        <Phone className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="truncate">{card.telefone ?? 'Sem telefone'}</span>
                    </div>
                    <Badge variant={BADGE_VARIANT[status]} className="border-none bg-amber-400/15 text-amber-200">
                        {COLUNAS.find((c) => c.status === status)?.label ?? 'A Contatar'}
                    </Badge>
                </div>
            </CardContent>
        </Card>
    )
}

const isStatusColuna = (id: string): id is RelacionamentoStatus => COLUNAS.some((coluna) => coluna.status === id)

const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    const colunaCollision = pointerCollisions.find((collision) => isStatusColuna(String(collision.id)))

    if (colunaCollision) {
        return [colunaCollision]
    }

    return closestCenter(args)
}

export function Relacionamento() {
    const [searchParams, setSearchParams] = useSearchParams()
    const location = useLocation()
    const toast = useToast()

    const abaInicial = useMemo<RelacionamentoAba>(() => {
        const abaQuery = searchParams.get('aba')
        if (abaQuery === 'reativacao' || abaQuery === 'recompra' || abaQuery === 'cobranca') {
            return abaQuery
        }

        const state = location.state as { aba?: RelacionamentoAba } | null
        if (state?.aba) return state.aba

        return 'reativacao'
    }, [location.state, searchParams])

    const [abaAtiva, setAbaAtiva] = useState<RelacionamentoAba>(abaInicial)
    const [activeCardId, setActiveCardId] = useState<string | null>(null)
    const { data = [], isLoading, error } = useKanbanData(abaAtiva)
    const moverCard = useMoverCard()

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    )

    useEffect(() => {
        if (abaInicial !== abaAtiva) setAbaAtiva(abaInicial)
    }, [abaAtiva, abaInicial])

    const colunas = useMemo(() => {
        return COLUNAS.map((coluna) => ({
            ...coluna,
            cards: data.filter(
                (item): item is KanbanRow & { contato_id: string } =>
                    item.status_relacionamento === coluna.status && typeof item.contato_id === 'string'
            ),
        }))
    }, [data])

    const cardStatusMap = useMemo(() => {
        const map = new Map<string, RelacionamentoStatus>()
        for (const card of data) {
            if (card.contato_id && card.status_relacionamento) {
                map.set(card.contato_id, card.status_relacionamento)
            }
        }
        return map
    }, [data])

    const handleTrocarAba = (value: string) => {
        const novaAba = value as RelacionamentoAba
        setAbaAtiva(novaAba)
        setSearchParams({ aba: novaAba })
    }

    const handleDragStart = (event: DragStartEvent) => {
        setActiveCardId(String(event.active.id))
    }

    const handleDragCancel = (_event: DragCancelEvent) => {
        setActiveCardId(null)
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

    const activeCard = useMemo(() => {
        if (!activeCardId) return null

        const card = data.find(
            (item): item is KanbanRow & { contato_id: string } =>
                typeof item.contato_id === 'string' && item.contato_id === activeCardId
        )

        return card ?? null
    }, [activeCardId, data])

    return (
        <>
            <Header title="Relacionamento" showBack centerTitle transparent />
            <PageContainer className="pt-0 pb-24 px-4 bg-transparent">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-0 opacity-60">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.10),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_40%)]" />
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:3px_3px]" />
                    </div>

                    <div className="relative space-y-4">
                        <Tabs value={abaAtiva} onValueChange={handleTrocarAba}>
                            <TabsList className="bg-white/5 border border-white/10">
                                {ABAS.map((aba) => (
                                    <TabsTrigger key={aba.value} value={aba.value} className="data-[state=active]:bg-black/70 text-[11px]">
                                        {aba.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>

                        {isLoading && (
                            <div className="flex items-center justify-center py-12 text-zinc-300">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Carregando Kanban...
                            </div>
                        )}

                        {error && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                                {error instanceof Error ? error.message : 'Erro ao carregar dados'}
                            </div>
                        )}

                        {!isLoading && !error && (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={collisionDetectionStrategy}
                                onDragStart={handleDragStart}
                                onDragCancel={handleDragCancel}
                                onDragEnd={(event) => {
                                    setActiveCardId(null)
                                    void handleDragEnd(event)
                                }}
                            >
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {colunas.map((coluna) => (
                                        <DroppableColuna key={coluna.status} status={coluna.status}>
                                            <div className="mb-3 flex items-center justify-between">
                                                <h2 className="text-sm font-semibold text-zinc-100">{coluna.label}</h2>
                                                <Badge variant={BADGE_VARIANT[coluna.status]} className="bg-black/40 text-[11px]">
                                                    {coluna.cards.length}
                                                </Badge>
                                            </div>

                                            <SortableContext items={coluna.cards.map((c) => c.contato_id)} strategy={verticalListSortingStrategy}>
                                                <div className="min-h-28 space-y-3">
                                                    {coluna.cards.map((card) => (
                                                        <SortableCard key={card.contato_id} card={card} />
                                                    ))}

                                                    {coluna.cards.length === 0 && (
                                                        <div className="rounded-xl border border-dashed border-white/10 bg-black/30 py-6 text-center text-xs text-zinc-500">
                                                            Nenhum cliente
                                                        </div>
                                                    )}
                                                </div>
                                            </SortableContext>
                                        </DroppableColuna>
                                    ))}
                                </div>

                                <DragOverlay>{activeCard ? <OverlayCard card={activeCard} /> : null}</DragOverlay>
                            </DndContext>
                        )}
                    </div>
                </div>
            </PageContainer>
        </>
    )
}
