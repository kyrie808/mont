import { Loader2, Wallet, CalendarDays, PackageCheck } from 'lucide-react'
import { useEntregas } from '../hooks/useEntregas'
import { moeda, hojeSP } from '../lib/format'

export function GanhosPage() {
    const { data, isLoading } = useEntregas()
    const entregues = (data ?? []).filter((e) => e.status_entrega === 'entregue')

    const hoje = hojeSP()
    const hojeEntregues = entregues.filter((e) => e.data === hoje)

    const soma = (arr: typeof entregues) => arr.reduce((acc, e) => acc + Number(e.repasse ?? 0), 0)
    const totalGanho = soma(entregues)
    const hojeGanho = soma(hojeEntregues)

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1 className="text-lg font-black text-slate-900">Ganhos</h1>
                <p className="text-xs text-slate-500">Seu repasse por entrega realizada</p>
            </header>

            <main className="space-y-4 p-4">
                {isLoading ? (
                    <div className="flex justify-center py-16 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Destaque: total a receber */}
                        <div className="rounded-2xl bg-emerald-600 p-5 text-white shadow-sm">
                            <div className="flex items-center gap-2 text-sm font-medium text-emerald-50">
                                <Wallet className="h-4 w-4" /> Total a receber
                            </div>
                            <p className="mt-1 text-3xl font-black tabular-nums">{moeda(totalGanho)}</p>
                            <p className="mt-1 text-sm text-emerald-50">
                                {entregues.length} entrega(s) realizada(s)
                            </p>
                        </div>

                        {/* Hoje */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <CalendarDays className="h-4 w-4 text-slate-400" /> Hoje
                            </div>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-2xl font-black text-slate-900 tabular-nums">{moeda(hojeGanho)}</span>
                                <span className="flex items-center gap-1 text-sm text-slate-500">
                                    <PackageCheck className="h-4 w-4" /> {hojeEntregues.length} entrega(s)
                                </span>
                            </div>
                        </div>

                        <p className="px-1 text-center text-xs text-slate-400">
                            O acerto do valor é feito com a Mont. Dúvidas, fale com o comercial.
                        </p>
                    </>
                )}
            </main>
        </div>
    )
}
