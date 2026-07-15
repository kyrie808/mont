import { Truck, DollarSign } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../../ui/Tabs'

interface VendasFilterTabsProps {
    statusFilter: string | null
    setStatusFilter: (val: 'todos' | 'pendente' | 'entregue' | 'cancelada') => void
    pagamentoFilter: string | null
    setPagamentoFilter: (val: 'todos' | 'pago' | 'parcial' | 'pendente') => void
    deliveryCounts: { todos: number; entregue: number; pendente: number; cancelada: number }
    paymentCounts: { todos: number; pago: number; parcial: number; pendente: number }
}

function Count({ n }: { n: number }) {
    return (
        <span className="ml-1 rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
            {n}
        </span>
    )
}

/**
 * Versão desktop dos filtros de venda: dois segmented controls independentes
 * (Entrega + Pagamento) — combináveis, já que `filteredVendas` faz o AND.
 * Mobile mantém as fileiras de badges do `VendasFilters`.
 */
export function VendasFilterTabs({
    statusFilter,
    setStatusFilter,
    pagamentoFilter,
    setPagamentoFilter,
    deliveryCounts,
    paymentCounts,
}: VendasFilterTabsProps) {
    return (
        <div className="space-y-2">
            {/* Entrega */}
            <div className="flex items-center gap-3">
                <div className="shrink-0 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Truck className="h-4 w-4" />
                </div>
                <Tabs
                    value={statusFilter ?? 'todos'}
                    onValueChange={(v) => setStatusFilter(v as 'todos' | 'pendente' | 'entregue' | 'cancelada')}
                >
                    <TabsList>
                        <TabsTrigger value="todos">Todas<Count n={deliveryCounts.todos} /></TabsTrigger>
                        <TabsTrigger value="entregue">Entregues<Count n={deliveryCounts.entregue} /></TabsTrigger>
                        <TabsTrigger value="pendente">Pendentes<Count n={deliveryCounts.pendente} /></TabsTrigger>
                        <TabsTrigger value="cancelada">Canceladas<Count n={deliveryCounts.cancelada} /></TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Pagamento */}
            <div className="flex items-center gap-3">
                <div className="shrink-0 flex size-9 items-center justify-center rounded-xl bg-success/10 text-success">
                    <DollarSign className="h-4 w-4" />
                </div>
                <Tabs
                    value={pagamentoFilter ?? 'todos'}
                    onValueChange={(v) => setPagamentoFilter(v as 'todos' | 'pago' | 'parcial' | 'pendente')}
                >
                    <TabsList>
                        <TabsTrigger value="todos">Todos<Count n={paymentCounts.todos} /></TabsTrigger>
                        <TabsTrigger value="pago">Quitados<Count n={paymentCounts.pago} /></TabsTrigger>
                        <TabsTrigger value="parcial">Parciais<Count n={paymentCounts.parcial} /></TabsTrigger>
                        <TabsTrigger value="pendente">Pendentes<Count n={paymentCounts.pendente} /></TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
        </div>
    )
}
