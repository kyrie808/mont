import { useState } from 'react'
import { Receipt, Filter, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '../../ui'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { ExtratoItem } from '@/types/database'

interface ExtratoMensalProps {
    extrato: ExtratoItem[]
    loadingExtrato: boolean
}

export function ExtratoMensal({ extrato, loadingExtrato }: ExtratoMensalProps) {
    const [paginaAtual, setPaginaAtual] = useState(1)
    const itensPorPagina = 10

    // Reset pagination when month changes - handled by key in parent
    // useEffect(() => {
    //     setPaginaAtual(1)
    // }, [selectedMonth])

    const totalPaginas = Math.ceil(extrato.length / itensPorPagina)
    const extratosPaginados = extrato.slice(
        (paginaAtual - 1) * itensPorPagina,
        paginaAtual * itensPorPagina
    )

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Extrato do Mês
                </h2>
                {!loadingExtrato && extrato.length > 0 && (
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        {extrato.length} lançamentos
                    </span>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                {loadingExtrato ? (
                    <div className="p-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-zinc-500 uppercase">Sincronizando lançamentos...</p>
                    </div>
                ) : extrato.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-700">
                            <Filter className="w-8 h-8 text-zinc-300" />
                        </div>
                        <p className="text-sm font-bold text-zinc-400 uppercase">Nenhum lançamento registrado</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {extratosPaginados.map((item: ExtratoItem) => (
                                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                                            item.tipo === 'receita' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30" :
                                                item.tipo === 'despesa' ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30" :
                                                    "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"
                                        )}>
                                            {item.tipo === 'receita' ? <ArrowUpRight className="w-6 h-6" /> :
                                                item.tipo === 'despesa' ? <ArrowDownLeft className="w-6 h-6" /> :
                                                    <ArrowRightLeft className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">{item.descricao}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">
                                                    {format(new Date(item.data + 'T12:00:00'), 'dd/MM')}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                                <Badge variant="outline" className="text-[9px] py-0 h-4 border-zinc-200 dark:border-zinc-700 text-zinc-500">
                                                    {item.categoria_nome || 'Lançamento'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-base font-black tracking-tight",
                                            item.tipo === 'receita' ? "text-emerald-600 dark:text-emerald-400" :
                                                item.tipo === 'despesa' ? "text-red-600 dark:text-red-400" :
                                                    "text-zinc-900 dark:text-white"
                                        )}>
                                            {item.tipo === 'despesa' ? '- ' : item.tipo === 'receita' ? '+ ' : ''}{formatCurrency(item.valor || 0)}
                                        </p>
                                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.origem}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {totalPaginas > 1 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
                                <button
                                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                                    disabled={paginaAtual === 1}
                                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Anterior
                                </button>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
                                    Página {paginaAtual} de {totalPaginas}
                                </span>
                                <button
                                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                    Próxima <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    )
}
