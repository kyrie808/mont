import { PackageOpen, Loader2 } from 'lucide-react'
import { useEntregas } from '../hooks/useEntregas'
import { EntregaCard } from '../components/EntregaCard'

export function HistoricoPage() {
    const { data, isLoading } = useEntregas()
    const entregues = (data ?? []).filter((e) => e.status_entrega === 'entregue')

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1 className="text-lg font-black text-slate-900">Histórico</h1>
                <p className="text-xs text-slate-500">{entregues.length} entrega(s) concluída(s)</p>
            </header>

            <main className="space-y-3 p-4">
                {isLoading ? (
                    <div className="flex justify-center py-16 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : entregues.length === 0 ? (
                    <div className="flex flex-col items-center py-16 text-center text-slate-400">
                        <PackageOpen className="mb-3 h-10 w-10" />
                        <p className="font-medium">Nenhuma entrega concluída ainda.</p>
                    </div>
                ) : (
                    entregues.map((e) => (
                        <EntregaCard
                            key={e.venda_id}
                            entrega={e}
                            onRecebido={() => {}}
                            onEntregue={() => {}}
                            processando={false}
                        />
                    ))
                )}
            </main>
        </div>
    )
}
