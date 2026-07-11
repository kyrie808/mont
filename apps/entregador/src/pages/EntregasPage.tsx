import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, PackageOpen, Loader2 } from 'lucide-react'
import { entregasService } from '../services/entregasService'
import { useEntregas } from '../hooks/useEntregas'
import { EntregaCard } from '../components/EntregaCard'

export function EntregasPage() {
    const queryClient = useQueryClient()
    const [vendaEmAcao, setVendaEmAcao] = useState<string | null>(null)
    const [erro, setErro] = useState<string | null>(null)

    const { data: entregas, isLoading, isFetching, refetch } = useEntregas()

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

    // Só as pendentes; as concluídas vão pra aba Histórico.
    const pendentes = (entregas ?? []).filter((e) => e.status_entrega !== 'entregue')

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <div>
                    <h1 className="text-lg font-black text-slate-900">Minhas entregas</h1>
                    <p className="text-xs text-slate-500">{pendentes.length} pendente(s)</p>
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
                    pendentes.map((e) => (
                        <EntregaCard
                            key={e.venda_id}
                            entrega={e}
                            onRecebido={(id) => recebidoMutation.mutate(id)}
                            onEntregue={(id) => entregueMutation.mutate(id)}
                            processando={vendaEmAcao === e.venda_id}
                        />
                    ))
                )}
            </main>
        </div>
    )
}
