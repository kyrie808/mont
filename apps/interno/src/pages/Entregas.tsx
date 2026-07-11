import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Truck, Loader2, Banknote, Check } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { entregadorService } from '../services/entregadorService'
import { formatCurrency, cn } from '@mont/shared'
import { useToast } from '../components/ui/Toast'

// Hub de entregas/repasse (v1 = dinheiro a acertar + extrato). As features do Gilmar expandem isto depois.
export function Entregas() {
    const toast = useToast()
    const queryClient = useQueryClient()
    const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'))
    const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
    const base = new Date(mes + '-01T12:00:00')
    const inicio = format(startOfMonth(base), 'yyyy-MM-dd')
    const fim = format(endOfMonth(base), 'yyyy-MM-dd')

    const { data: aAcertar } = useQuery({
        queryKey: ['dinheiro-a-acertar'],
        queryFn: () => entregadorService.getDinheiroAAcertar(),
    })

    const { data: extrato, isLoading } = useQuery({
        queryKey: ['extrato-entregadores', inicio, fim],
        queryFn: () => entregadorService.getExtrato(inicio, fim),
    })

    const acertarMut = useMutation({
        mutationFn: (id: string) => entregadorService.confirmarDinheiroAcertado(id),
        onMutate: (id) => setConfirmandoId(id),
        onError: () => toast.error('Não foi possível confirmar. Tente de novo.'),
        onSuccess: () => {
            toast.success('Recebimento confirmado.')
            queryClient.invalidateQueries({ queryKey: ['dinheiro-a-acertar'] })
            queryClient.invalidateQueries({ queryKey: ['extrato-entregadores'] })
        },
        onSettled: () => setConfirmandoId(null),
    })

    const pendentes = aAcertar ?? []
    const totalAAcertar = pendentes.reduce((acc, v) => acc + v.total, 0)
    const lista = extrato ?? []

    return (
        <>
            <Header title="Entregas" showBack centerTitle />
            <PageContainer className="pb-24 px-4">
                {/* Dinheiro a acertar: o entregador recolheu em dinheiro e a Mont ainda não recebeu de volta */}
                {pendentes.length > 0 && (
                    <div className="mb-6">
                        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                            <Banknote className="h-4 w-4 text-warning-strong" /> Dinheiro a acertar
                            <span className="ml-auto font-mono text-warning-strong">{formatCurrency(totalAAcertar)}</span>
                        </h2>
                        <p className="mb-3 text-xs text-muted-foreground">
                            Dinheiro que o entregador recolheu do cliente e a Mont ainda não recebeu de volta.
                        </p>
                        <div className="space-y-2">
                            {pendentes.map((v) => (
                                <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-warning-strong/30 bg-warning-strong/5 p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">{v.clienteNome}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCurrency(v.total)}
                                            {v.recebidoEm && ` · recolhido ${format(new Date(v.recebidoEm), 'dd/MM')}`}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={confirmandoId === v.id}
                                        onClick={() => acertarMut.mutate(v.id)}
                                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-success-foreground active:scale-95 disabled:opacity-60"
                                    >
                                        {confirmandoId === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                        Recebi
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Extrato de repasse */}
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <Truck className="h-5 w-5 text-primary" /> Repasse aos entregadores
                        </h2>
                        <p className="text-xs text-muted-foreground">Devido × pago × saldo no mês</p>
                    </div>
                    <input
                        type="month"
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : lista.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                        Nenhum entregador ativo.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lista.map((e) => {
                            const saldo = Number(e.saldo_repasse)
                            return (
                                <div key={e.entregador_id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-foreground">{e.nome}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {Number(e.entregas)} entrega(s) · {formatCurrency(Number(e.repasse_por_entrega))}/entrega
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saldo a pagar</p>
                                            <p className={cn(
                                                'text-xl font-black tabular-nums',
                                                saldo > 0 ? 'text-warning-strong' : 'text-success'
                                            )}>
                                                {formatCurrency(saldo)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Devido</p>
                                            <p className="font-bold text-foreground tabular-nums">{formatCurrency(Number(e.devido))}</p>
                                        </div>
                                        <div className="rounded-lg bg-muted/50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pago</p>
                                            <p className="font-bold text-foreground tabular-nums">{formatCurrency(Number(e.pago))}</p>
                                        </div>
                                    </div>

                                    {Number(e.dinheiro_coletado) > 0 && (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Dinheiro da Mont em mãos (a acertar): {formatCurrency(Number(e.dinheiro_coletado))}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </PageContainer>
        </>
    )
}
