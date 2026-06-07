import { useState } from 'react'
import { Receipt, Filter, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '../../ui'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { ExtratoItem } from '@mont/shared'

interface ExtratoMensalProps {
    extrato: ExtratoItem[]
    loadingExtrato: boolean
}

export function ExtratoMensal({ extrato, loadingExtrato }: ExtratoMensalProps) {
    const [paginaAtual, setPaginaAtual] = useState(1)
    const itensPorPagina = 10

    const totalPaginas = Math.ceil(extrato.length / itensPorPagina)
    const extratosPaginados = extrato.slice(
        (paginaAtual - 1) * itensPorPagina,
        paginaAtual * itensPorPagina
    )

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Extrato do Mês
                </h2>
                {!loadingExtrato && extrato.length > 0 && (
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {extrato.length} lançamentos
                    </span>
                )}
            </div>

            <div className="bg-card rounded-4xl border border-border shadow-elevated overflow-hidden">
                {loadingExtrato ? (
                    <div className="p-12 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-muted-foreground uppercase">Sincronizando lançamentos...</p>
                    </div>
                ) : extrato.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                            <Filter className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground uppercase">Nenhum lançamento registrado</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-border">
                            {extratosPaginados.map((item: ExtratoItem) => (
                                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-muted/60 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                                            item.tipo === 'receita' ? "bg-success/10 text-success border-success/20" :
                                                item.tipo === 'despesa' ? "bg-destructive/10 text-destructive border-destructive/20" :
                                                    "bg-muted text-muted-foreground border-border"
                                        )}>
                                            {item.tipo === 'receita' ? <ArrowUpRight className="w-6 h-6" /> :
                                                item.tipo === 'despesa' ? <ArrowDownLeft className="w-6 h-6" /> :
                                                    <ArrowRightLeft className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-foreground leading-tight">{item.descricao}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    {format(new Date(item.data + 'T12:00:00'), 'dd/MM')}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                <Badge variant="outline" className="text-[9px] py-0 h-4 border-border text-muted-foreground">
                                                    {item.categoria_nome || 'Lançamento'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-base font-black tracking-tight",
                                            item.tipo === 'receita' ? "text-success" :
                                                item.tipo === 'despesa' ? "text-destructive" :
                                                    "text-foreground"
                                        )}>
                                            {item.tipo === 'despesa' ? '- ' : item.tipo === 'receita' ? '+ ' : ''}{formatCurrency(item.valor || 0)}
                                        </p>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.origem}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {totalPaginas > 1 && (
                            <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                                <button
                                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                                    disabled={paginaAtual === 1}
                                    className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Anterior
                                </button>
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                    Página {paginaAtual} de {totalPaginas}
                                </span>
                                <button
                                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed hover:text-foreground transition-colors"
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
