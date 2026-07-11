import { useQuery } from '@tanstack/react-query'
import { LogOut, User, Truck, Loader2 } from 'lucide-react'
import { entregasService } from '../services/entregasService'
import { useAuth } from '../hooks/useAuth'
import { moeda } from '../lib/format'

export function PerfilPage() {
    const { signOut } = useAuth()
    const { data: perfil, isLoading } = useQuery({
        queryKey: ['meu-perfil'],
        queryFn: () => entregasService.meuPerfil(),
    })

    return (
        <div className="mx-auto min-h-dvh max-w-md pb-24">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
                <h1 className="text-lg font-black text-slate-900">Perfil</h1>
            </header>

            <main className="space-y-4 p-4">
                {isLoading ? (
                    <div className="flex justify-center py-16 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <User className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-slate-900">{perfil?.nome ?? 'Entregador'}</p>
                                <p className="text-xs text-slate-500">Entregador · Mont</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                            <span className="flex items-center gap-1.5 text-slate-600">
                                <Truck className="h-4 w-4 text-slate-400" /> Repasse por entrega
                            </span>
                            <span className="font-bold text-slate-900 tabular-nums">{moeda(perfil?.repasse_por_entrega)}</span>
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => signOut()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 font-bold text-red-600 active:scale-95"
                >
                    <LogOut className="h-5 w-5" /> Sair
                </button>
            </main>
        </div>
    )
}
