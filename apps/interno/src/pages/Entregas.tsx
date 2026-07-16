import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Loader2, ListOrdered, SlidersHorizontal, Truck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { entregadorService } from '../services/entregadorService'
import { useEntregadores } from '../hooks/useEntregadores'
import { useToast } from '../components/ui/Toast'
import {
    DinheiroAAcertarCard,
    EntregaRow,
    RepasseCard,
    EntregasHubDesktop,
} from '../components/features/entregas'

// Hub de entregas/repasse. Filtro (entregador + mês) scopeia "Entregas atribuídas" e
// "Repasse"; "Dinheiro a acertar" é alerta sempre-visível (sem filtro).
// Mobile (<lg): pilha de seções — layout sagrado, intocado.
// Desktop (≥lg): hub de 2 colunas (EntregasHubDesktop). Ambos compartilham este fetch.
export function Entregas() {
    const toast = useToast()
    const navigate = useNavigate()
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

    // Cache unificada com o checkout (mesma queryKey ['entregadores','ativos']).
    const { entregadores: entregadoresAtivos } = useEntregadores()

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

    // Posição na rota = índice dentro da sequência de cada entregador (nunca "-";
    // bate com o app). A lista já vem ordenada por entregador → ordem_rota → data.
    const posMap = useMemo(() => {
        const counter: Record<string, number> = {}
        const m: Record<string, number> = {}
        for (const e of entregasLista ?? []) {
            counter[e.entregadorId] = (counter[e.entregadorId] ?? 0) + 1
            m[e.id] = counter[e.entregadorId]
        }
        return m
    }, [entregasLista])

    const pendentes = aAcertar ?? []
    const totalAAcertar = pendentes.reduce((acc, v) => acc + v.total, 0)
    // Repasse: obedece o filtro de entregador (client-side; a RPC devolve todos).
    const lista = (extrato ?? []).filter((e) => !filtroEntregador || e.entregador_id === filtroEntregador)
    const listaEntregas = entregasLista ?? []

    return (
        <>
            <Header title="Entregas" showBack centerTitle />
            <PageContainer className="pb-24">
                {/* ===== MOBILE (<lg): pilha de seções — layout sagrado, intocado ===== */}
                <div className="lg:hidden">
                    {/* Dinheiro a acertar — alerta sempre-visível (sem filtro) */}
                    <DinheiroAAcertarCard
                        pendentes={pendentes}
                        total={totalAAcertar}
                        confirmandoId={confirmandoId}
                        onAcertar={(id) => acertarMut.mutate(id)}
                    />

                    {/* Filtro — scopeia Entregas atribuídas + Repasse */}
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
                            {entregadoresAtivos.map((e) => (
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
                        ) : listaEntregas.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                                Nenhuma entrega atribuída no período.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {listaEntregas.map((e) => (
                                    <EntregaRow
                                        key={e.id}
                                        entrega={e}
                                        posicao={posMap[e.id]}
                                        showEntregador={filtroEntregador === ''}
                                        onClick={() => navigate(`/vendas/${e.id}`)}
                                    />
                                ))}
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
                            {lista.map((e) => (
                                <RepasseCard key={e.entregador_id} extrato={e} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ===== DESKTOP (≥lg): hub de 2 colunas ===== */}
                <div className="hidden lg:block">
                    <EntregasHubDesktop
                        mes={mes}
                        onMesChange={setMes}
                        entregadores={entregadoresAtivos}
                        filtroEntregador={filtroEntregador}
                        onFiltroEntregadorChange={setFiltroEntregador}
                        incluirEntregues={incluirEntregues}
                        onIncluirEntreguesChange={setIncluirEntregues}
                        entregasLista={listaEntregas}
                        loadingEntregas={loadingEntregas}
                        posMap={posMap}
                        onEntregaClick={(id) => navigate(`/vendas/${id}`)}
                        pendentes={pendentes}
                        totalAAcertar={totalAAcertar}
                        confirmandoId={confirmandoId}
                        onAcertar={(id) => acertarMut.mutate(id)}
                        extratoLista={lista}
                        loadingExtrato={isLoading}
                    />
                </div>
            </PageContainer>
        </>
    )
}
