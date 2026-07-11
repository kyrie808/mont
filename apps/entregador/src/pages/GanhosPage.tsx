import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Wallet, CalendarDays, PackageCheck, Receipt } from 'lucide-react'
import { useEntregas } from '../hooks/useEntregas'
import { entregasService } from '../services/entregasService'
import { moeda, hojeSP, dataBR } from '../lib/format'

export function GanhosPage() {
    const { data, isLoading } = useEntregas()
    const { data: repasses } = useQuery({
        queryKey: ['meus-repasses'],
        queryFn: () => entregasService.meusRepasses(),
    })
    const [erro, setErro] = useState<string | null>(null)

    const entregues = (data ?? []).filter((e) => e.status_entrega === 'entregue')
    const hoje = hojeSP()
    const hojeEntregues = entregues.filter((e) => e.data === hoje)

    const soma = (arr: typeof entregues) => arr.reduce((acc, e) => acc + Number(e.repasse ?? 0), 0)
    const totalGanho = soma(entregues)
    const hojeGanho = soma(hojeEntregues)

    const lista = repasses ?? []

    const verComprovante = async (path: string) => {
        setErro(null)
        // Abre a aba já (síncrono) e navega após pegar a signed URL — evita bloqueio de popup.
        const win = window.open('', '_blank', 'noopener')
        try {
            const url = await entregasService.comprovanteUrl(path)
            if (win) win.location.href = url
            else window.location.href = url
        } catch {
            win?.close()
            setErro('Não foi possível abrir o comprovante. Tente de novo.')
        }
    }

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1 className="text-lg font-black text-slate-900">Ganhos</h1>
                <p className="text-xs text-slate-500">Seu repasse por entrega realizada</p>
            </header>

            {erro && (
                <p className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>
            )}

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

                        {/* Repasses recebidos da Mont */}
                        <div>
                            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Repasses recebidos da Mont
                            </p>
                            {lista.length === 0 ? (
                                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
                                    Nenhum repasse registrado ainda.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {lista.map((r) => (
                                        <div
                                            key={r.lancamento_id}
                                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 tabular-nums">{moeda(r.valor)}</p>
                                                <p className="truncate text-xs text-slate-500">{r.categoria} · {dataBR(r.data)}</p>
                                            </div>
                                            {r.comprovante_url ? (
                                                <button
                                                    type="button"
                                                    onClick={() => verComprovante(r.comprovante_url!)}
                                                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 active:scale-95"
                                                >
                                                    <Receipt className="h-4 w-4" /> Comprovante
                                                </button>
                                            ) : (
                                                <span className="shrink-0 text-xs text-slate-400">sem comprovante</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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
