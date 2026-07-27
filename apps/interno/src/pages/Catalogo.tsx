import { useState, useEffect } from 'react'
import { Plus, LayoutList, PackageSearch, AlertTriangle } from 'lucide-react'
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    closestCenter,
    type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useNavigate } from 'react-router-dom'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Button, Spinner, EmptyState, ConfirmDialog } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { useSecoes, useSecaoItens, useProdutosOrfaos } from '../hooks/useSecoes'
import type { SecaoComContagem, SecaoItem } from '../services/secaoService'
import type { Secao } from '@mont/shared'
import { SortableSecaoRow } from '../components/features/catalogo/SortableSecaoRow'
import { SortableProdutoRow } from '../components/features/catalogo/SortableProdutoRow'
import { SecaoFormModal } from '../components/features/catalogo/SecaoFormModal'

export function Catalogo() {
    const { openDrawer } = useNavigationStore()
    const navigate = useNavigate()
    const toast = useToast()
    const { secoes, loading, createSecao, updateSecao, deleteSecao, reorderSecoes } = useSecoes()
    const orfaos = useProdutosOrfaos()

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [orderedSecoes, setOrderedSecoes] = useState<SecaoComContagem[]>([])
    useEffect(() => {
        setOrderedSecoes(secoes)
    }, [secoes])
    useEffect(() => {
        if (orderedSecoes.length === 0) {
            setSelectedId(null)
            return
        }
        if (!selectedId || !orderedSecoes.some((s) => s.id === selectedId)) {
            setSelectedId(orderedSecoes[0].id)
        }
    }, [orderedSecoes, selectedId])

    const { itens, removeItem, reorderItens } = useSecaoItens(selectedId ?? undefined)
    const [orderedItens, setOrderedItens] = useState<SecaoItem[]>([])
    useEffect(() => {
        setOrderedItens(itens)
    }, [itens])

    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Secao | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<SecaoComContagem | null>(null)
    const [deleting, setDeleting] = useState(false)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const selectedSecao = orderedSecoes.find((s) => s.id === selectedId) ?? null

    const handleSecaoDragEnd = (e: DragEndEvent) => {
        const { active, over } = e
        if (!over || active.id === over.id) return
        const oldIndex = orderedSecoes.findIndex((s) => s.id === active.id)
        const newIndex = orderedSecoes.findIndex((s) => s.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        const next = arrayMove(orderedSecoes, oldIndex, newIndex)
        setOrderedSecoes(next)
        reorderSecoes(next.map((s) => s.id)).catch(() => toast.error('Erro ao reordenar seções'))
    }

    const handleItemDragEnd = (e: DragEndEvent) => {
        const { active, over } = e
        if (!over || active.id === over.id || !selectedId) return
        const oldIndex = orderedItens.findIndex((i) => i.produto_id === active.id)
        const newIndex = orderedItens.findIndex((i) => i.produto_id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        const next = arrayMove(orderedItens, oldIndex, newIndex)
        setOrderedItens(next)
        reorderItens(next.map((i) => i.produto_id)).catch(() => toast.error('Erro ao reordenar itens'))
    }

    const openNew = () => {
        setEditTarget(null)
        setFormOpen(true)
    }
    const openEdit = (s: SecaoComContagem) => {
        setEditTarget(s)
        setFormOpen(true)
    }

    const handleFormSubmit = async (values: { nome: string; ativa: boolean }) => {
        try {
            if (editTarget) {
                await updateSecao(editTarget.id, values)
                toast.success('Seção atualizada')
            } else {
                const nova = await createSecao({ nome: values.nome })
                setSelectedId(nova.id)
                toast.success('Seção criada')
            }
        } catch (e) {
            toast.error('Erro ao salvar seção')
            throw e
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            await deleteSecao(deleteTarget.id)
            toast.success('Seção excluída')
            setDeleteTarget(null)
        } catch {
            toast.error('Erro ao excluir seção')
        } finally {
            setDeleting(false)
        }
    }

    const handleRemove = async (produtoId: string) => {
        try {
            await removeItem(produtoId)
            toast.success('Produto removido da seção')
        } catch {
            toast.error('Erro ao remover produto')
        }
    }

    return (
        <>
            <Header
                title="Catálogo"
                showMenu
                onMenuClick={openDrawer}
                rightAction={
                    <Button size="sm" variant="primary" leftIcon={<Plus className="size-4" />} onClick={openNew}>
                        Nova seção
                    </Button>
                }
            />

            <PageContainer className="pb-24">
                <p className="mb-4 text-sm text-muted-foreground">
                    Monte as <span className="font-semibold text-foreground">abas</span> do catálogo: crie seções e
                    arraste para ordená-las. Os produtos entram em cada seção pelo{' '}
                    <button onClick={() => navigate('/produtos')} className="font-semibold text-primary hover:underline">
                        cadastro do produto
                    </button>{' '}
                    (campo "Seção da vitrine"); aqui você define a ordem deles dentro da aba.
                </p>

                {orfaos.length > 0 && (
                    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-2 text-warning-strong">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <p className="text-sm">
                                <span className="font-bold">
                                    {orfaos.length} produto{orfaos.length > 1 ? 's' : ''} sem seção
                                </span>{' '}
                                — visível no catálogo mas em nenhuma aba:{' '}
                                <span className="font-semibold">
                                    {orfaos.slice(0, 6).map((o) => o.nome).join(', ')}
                                    {orfaos.length > 6 ? ` e mais ${orfaos.length - 6}` : ''}
                                </span>
                                .
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="shrink-0"
                            onClick={() => navigate('/produtos')}
                        >
                            Resolver no cadastro
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex min-h-[40vh] items-center justify-center">
                        <Spinner size="lg" />
                    </div>
                ) : orderedSecoes.length === 0 ? (
                    <EmptyState
                        icon={<LayoutList className="size-10" />}
                        title="Nenhuma seção ainda"
                        description="Crie a primeira seção (aba) para começar a montar a vitrine."
                        action={
                            <Button variant="primary" leftIcon={<Plus className="size-4" />} onClick={openNew}>
                                Nova seção
                            </Button>
                        }
                    />
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
                        {/* Sidebar de seções */}
                        <div className="rounded-2xl border border-border bg-card p-3">
                            <div className="mb-2 flex items-center justify-between px-1">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Seções
                                </h2>
                                <button
                                    onClick={openNew}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                                >
                                    <Plus className="size-3.5" /> Nova
                                </button>
                            </div>
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSecaoDragEnd}>
                                <SortableContext
                                    items={orderedSecoes.map((s) => s.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-1.5">
                                        {orderedSecoes.map((s) => (
                                            <SortableSecaoRow
                                                key={s.id}
                                                secao={s}
                                                selected={s.id === selectedId}
                                                onSelect={() => setSelectedId(s.id)}
                                                onEdit={() => openEdit(s)}
                                                onDelete={() => setDeleteTarget(s)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>

                        {/* Painel de itens da seção selecionada */}
                        <div className="rounded-2xl border border-border bg-card p-3">
                            <div className="mb-3 flex items-center justify-between gap-2 px-1">
                                <h2 className="truncate text-sm font-bold text-foreground">
                                    {selectedSecao ? selectedSecao.nome : 'Selecione uma seção'}
                                </h2>
                                {selectedSecao && (
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        arraste para ordenar
                                    </span>
                                )}
                            </div>

                            {!selectedSecao ? null : orderedItens.length === 0 ? (
                                <EmptyState
                                    icon={<PackageSearch className="size-10" />}
                                    title="Seção vazia"
                                    description="Nenhum produto está nesta seção. Atribua a seção no cadastro do produto."
                                    action={
                                        <Button variant="secondary" onClick={() => navigate('/produtos')}>
                                            Ir para Produtos
                                        </Button>
                                    }
                                />
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                                    <SortableContext
                                        items={orderedItens.map((i) => i.produto_id)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-1.5">
                                            {orderedItens.map((i) => (
                                                <SortableProdutoRow
                                                    key={i.produto_id}
                                                    item={i}
                                                    onRemove={() => handleRemove(i.produto_id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>
                )}
            </PageContainer>

            <SecaoFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                initial={editTarget}
                onSubmit={handleFormSubmit}
            />

            <ConfirmDialog
                open={!!deleteTarget}
                title="Excluir seção"
                message={`Remover a seção "${deleteTarget?.nome ?? ''}"? Os produtos não são apagados — só ficam sem seção.`}
                variant="danger"
                confirmLabel="Excluir"
                isLoading={deleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    )
}
