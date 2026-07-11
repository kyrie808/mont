import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, PackageOpen, Loader2 } from 'lucide-react'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { entregasService, type Entrega } from '../services/entregasService'
import { useEntregas } from '../hooks/useEntregas'
import { SortableEntregaCard } from '../components/SortableEntregaCard'

export function EntregasPage() {
    const queryClient = useQueryClient()
    const [vendaEmAcao, setVendaEmAcao] = useState<string | null>(null)
    const [erro, setErro] = useState<string | null>(null)

    const { data: entregas, isLoading, isFetching, refetch } = useEntregas()

    // Só as pendentes; as concluídas vão pra aba Histórico.
    const pendentes = useMemo(
        () => (entregas ?? []).filter((e) => e.status_entrega !== 'entregue'),
        [entregas],
    )
    const byId = useMemo(
        () => new Map<string, Entrega>(pendentes.map((e) => [e.venda_id, e])),
        [pendentes],
    )

    // Ordem local (arrastável). Re-sincroniza com o servidor a cada refetch —
    // que já devolve na ordem_rota gravada.
    const [ordem, setOrdem] = useState<string[]>([])
    useEffect(() => {
        setOrdem(pendentes.map((e) => e.venda_id))
    }, [pendentes])

    const recebidoMutation = useMutation({
        mutationFn: (vendaId: string) => entregasService.marcarRecebidoDinheiro(vendaId),
        onMutate: (vendaId) => { setVendaEmAcao(vendaId); setErro(null) },
        onError: () => setErro('Não foi possível registrar o recebimento. Tente de novo.'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] }),
        onSettled: () => setVendaEmAcao(null),
    })

    const entregueMutation = useMutation({
        mutationFn: (vendaId: string) => entregasService.marcarEntregue(vendaId),
        onMutate: (vendaId) => { setVendaEmAcao(vendaId); setErro(null) },
        onError: () => setErro('Não foi possível confirmar a entrega. Tente de novo.'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] }),
        onSettled: () => setVendaEmAcao(null),
    })

    const notaMutation = useMutation({
        mutationFn: ({ vendaId, nota }: { vendaId: string; nota: string }) =>
            entregasService.salvarNota(vendaId, nota),
        onMutate: () => setErro(null),
        onError: () => setErro('Não foi possível salvar a observação. Tente de novo.'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] }),
    })

    const reordenarMutation = useMutation({
        mutationFn: (ids: string[]) => entregasService.reordenarRota(ids),
        onMutate: () => setErro(null),
        onError: () => setErro('Não foi possível salvar a ordem. Tente de novo.'),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entregas'] }),
    })

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setOrdem((prev) => {
            const oldIndex = prev.indexOf(String(active.id))
            const newIndex = prev.indexOf(String(over.id))
            if (oldIndex < 0 || newIndex < 0) return prev
            const nova = arrayMove(prev, oldIndex, newIndex)
            reordenarMutation.mutate(nova)
            return nova
        })
    }

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <div>
                    <h1 className="text-lg font-black text-slate-900">Minhas entregas</h1>
                    <p className="text-xs text-slate-500">{pendentes.length} pendente(s) · arraste para ordenar a rota</p>
                </div>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded-xl p-2 text-slate-500 active:scale-95"
                    aria-label="Atualizar"
                >
                    <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
            </header>

            {erro && (
                <p className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>
            )}

            <main className="space-y-3 p-4">
                {isLoading ? (
                    <div className="flex justify-center py-16 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : pendentes.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center text-slate-400">
                        <PackageOpen className="mb-3 h-10 w-10" />
                        <p className="font-medium">Nenhuma entrega pendente.</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
                            {ordem.map((id, i) => {
                                const e = byId.get(id)
                                if (!e) return null
                                return (
                                    <SortableEntregaCard
                                        key={id}
                                        entrega={e}
                                        posicao={i + 1}
                                        onRecebido={(vId) => recebidoMutation.mutate(vId)}
                                        onEntregue={(vId) => entregueMutation.mutate(vId)}
                                        onSalvarNota={(vId, nota) => notaMutation.mutate({ vendaId: vId, nota })}
                                        processando={vendaEmAcao === id}
                                    />
                                )
                            })}
                        </SortableContext>
                    </DndContext>
                )}
            </main>
        </div>
    )
}
