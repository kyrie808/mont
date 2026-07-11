import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Truck, Loader2, Banknote, Check, ListOrdered, SlidersHorizontal } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { entregadorService } from '../services/entregadorService'
import { formatCurrency, cn } from '@mont/shared'
import { useToast } from '../components/ui/Toast'

// Hub de entregas/repasse. Filtro GLOBAL (entregador + mês) scopeia "Entregas
// atribuídas" e "Repasse"; "Dinheiro a acertar" é alerta sempre-visível (sem filtro).
export function Entregas() {
    const toast = useToast()
    const queryClient = useQueryClient()
    const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM'))
    const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
    const [filtroEntregador, setFiltroEntregador] = useState('')
    const [incluirEntregues, setIncluirEntregues] = useState(false)
    const base = new Date(mes + '-01T12:00:00')
    const inicio = format(startOfMonth(base), 'yyyy-MM-dd')
    const fim = format(endOfMonth(base), 'yyyy-MM-dd')

    // Alerta: sempre completo (não obedece filtro) — dívida em aberto não pode sumir.
    const { data: aAcertar } = useQuery({
        queryKey: ['dinheiro-a-acertar'],
        queryFn: () => entregadorService.getDinheiroAAcertar(),
    })

    const { data: entregadoresAtivos } = useQuery({
        queryKey: ['entregadores-ativos'],
        queryFn: () => entregadorService.listAtivos(),
    })

    const { data: entregasLista, isLoading: loadingEntregas } = useQuery({
        queryKey: ['entregas-lista', filtroEntregador, incluirEntregues, inicio, fim],
        queryFn: () => entregadorService.getEntregas({
            entregadorId: filtroEntregador || undefined,
            incluirEntregues,
            inicio,
            fim,
        }),
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
            queryClient.invalidateQueries({ queryKey: ['entregas-lista'] })
        },
        onSettled: () => setConfirmandoId(null),
    })

    const pendentes = aAcertar ?? []
    const totalAAcertar = pendentes.reduce((acc, v) => acc + v.total, 0)
    // Repasse: obedece o filtro de entregador (client-side; a RPC devolve todos).
    const lista = (extrato ?? []).filter((e) => !filtroEntregador || e.entregador_id === filtroEntregador)

    return (
        <>
            <Header title="Entregas" showBack centerTitle />
            <PageContainer className="pb-24 px-4">
                {/* Dinheiro a acertar — alerta sempre-visível (sem filtro) */}
                {pendentes.length > 0 && (
                    <div className="mb-6">
                        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                            <Banknote className="h-4 w-4 text-warning-strong" /> Dinheiro a acertar
                            <span className="ml-auto font-mono text-warning-strong">{formatCurrency(totalAAcertar)}</span>
                        </h2>
                        <p className="mb-3 text-xs text-muted-foreground">
                            Dinheiro que o entregador recolheu do cliente e a Mont ainda não recebeu de volta. Mostra tudo em aberto, independente do filtro.
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

                {/* Filtro GLOBAL — scopeia Entregas atribuídas + Repasse */}
                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <SlidersHorizontal className="h-4 w-4" /> Filtro
                    </span>
                    <select
                        value={filtroEntregador}
                        onChange={(e) => setFiltroEntregador(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <option value="">Todos os entregadores</option>
                        {(entregadoresAtivos ?? []).map((e) => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                    </select>
                    <input
                        type="month"
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>

                {/* Entregas atribuídas — a rota (ordem definida pelo entregador no app) */}
                <div className="mb-6">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                            <ListOrdered className="h-5 w-5 text-primary" /> Entregas atribuídas
                        </h2>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={incluirEntregues}
                                onChange={(e) => setIncluirEntregues(e.target.checked)}
                                className="h-4 w-4 rounded border-border"
                            />
                            Incluir entregues
                        </label>
                    </div>

                    {loadingEntregas ? (
                        <div className="flex justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (entregasLista ?? []).length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                            Nenhuma entrega atribuída no período.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {(entregasLista ?? []).map((e) => {
                                const entregue = e.status === 'entregue'
                                return (
                                    <div key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-foreground">
                                            {e.ordemRota ?? '–'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">{e.clienteNome}</p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {e.enderecoCurto || 'Sem endereço'}
                                                {filtroEntregador === '' && ` · ${e.entregadorNome}`}
                                            </p>
                                        </div>
                                        <span className={cn(
                                            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold',
                                            entregue ? 'bg-success/15 text-success' : 'bg-warning-strong/15 text-warning-strong',
                                        )}>
                                            {entregue ? 'Entregue' : 'A fazer'}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Repasse aos entregadores — filtrado por mês + entregador */}
                <div className="mb-4">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <Truck className="h-5 w-5 text-primary" /> Repasse aos entregadores
                    </h2>
                    <p className="text-xs text-muted-foreground">Devido × pago × saldo no mês</p>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-16 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : lista.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                        Nenhum entregador no filtro.
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
