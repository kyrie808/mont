import { ListOrdered, Truck, Loader2 } from 'lucide-react'
import { EntregasDesktopToolbar } from './EntregasDesktopToolbar'
import { DinheiroAAcertarCard } from './DinheiroAAcertarCard'
import { EntregaRow } from './EntregaRow'
import { RepasseCard } from './RepasseCard'
import type {
    EntregaLista,
    DinheiroAAcertar,
    ExtratoEntregador,
    EntregadorOption,
} from '../../../services/entregadorService'

interface EntregasHubDesktopProps {
    mes: string
    onMesChange: (mes: string) => void
    entregadores: EntregadorOption[]
    filtroEntregador: string
    onFiltroEntregadorChange: (id: string) => void
    incluirEntregues: boolean
    onIncluirEntreguesChange: (v: boolean) => void

    entregasLista: EntregaLista[]
    loadingEntregas: boolean
    posMap: Record<string, number>
    onEntregaClick: (id: string) => void

    pendentes: DinheiroAAcertar[]
    totalAAcertar: number
    confirmandoId: string | null
    onAcertar: (id: string) => void

    extratoLista: ExtratoEntregador[]
    loadingExtrato: boolean
}

// Layout desktop (≥lg) da página Entregas: hub de 2 colunas. Esquerda (2/3) = a rota
// (Entregas atribuídas); direita (1/3) = financeiro (Dinheiro a acertar + Repasse).
// Recebe todos os dados/handlers da página — mesmo fetch que alimenta o mobile.
export function EntregasHubDesktop({
    mes,
    onMesChange,
    entregadores,
    filtroEntregador,
    onFiltroEntregadorChange,
    incluirEntregues,
    onIncluirEntreguesChange,
    entregasLista,
    loadingEntregas,
    posMap,
    onEntregaClick,
    pendentes,
    totalAAcertar,
    confirmandoId,
    onAcertar,
    extratoLista,
    loadingExtrato,
}: EntregasHubDesktopProps) {
    return (
        <div className="space-y-6">
            <EntregasDesktopToolbar
                mes={mes}
                onMesChange={onMesChange}
                entregadores={entregadores}
                filtroEntregador={filtroEntregador}
                onFiltroEntregadorChange={onFiltroEntregadorChange}
                incluirEntregues={incluirEntregues}
                onIncluirEntreguesChange={onIncluirEntreguesChange}
            />

            <div className="grid grid-cols-3 gap-6">
                {/* Esquerda (2/3): a rota */}
                <div className="col-span-2">
                    <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                        <ListOrdered className="h-5 w-5 text-primary" /> Entregas atribuídas
                    </h2>
                    {loadingEntregas ? (
                        <div className="flex justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : entregasLista.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                            Nenhuma entrega atribuída no período.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {entregasLista.map((e) => (
                                <EntregaRow
                                    key={e.id}
                                    entrega={e}
                                    posicao={posMap[e.id]}
                                    showEntregador={filtroEntregador === ''}
                                    onClick={() => onEntregaClick(e.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Direita (1/3): financeiro */}
                <div className="col-span-1 space-y-6">
                    <DinheiroAAcertarCard
                        pendentes={pendentes}
                        total={totalAAcertar}
                        confirmandoId={confirmandoId}
                        onAcertar={onAcertar}
                        emptyPlaceholder
                        className="mb-0"
                    />

                    <div>
                        <div className="mb-3">
                            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                                <Truck className="h-5 w-5 text-primary" /> Repasse aos entregadores
                            </h2>
                            <p className="text-xs text-muted-foreground">Devido × pago × saldo no mês</p>
                        </div>
                        {loadingExtrato ? (
                            <div className="flex justify-center py-16 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : extratoLista.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                                Nenhum entregador no filtro.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {extratoLista.map((e) => (
                                    <RepasseCard key={e.entregador_id} extrato={e} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
