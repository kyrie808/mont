import { Search, Truck, DollarSign } from 'lucide-react'
import { Badge } from '../../../components/ui'


interface VendasFiltersProps {
    searchTerm: string
    setSearchTerm: (val: string) => void
    statusFilter: string | null
    setStatusFilter: (val: 'todos' | 'pendente' | 'entregue' | 'cancelada') => void
    pagamentoFilter: string | null
    setPagamentoFilter: (val: 'todos' | 'pago' | 'parcial' | 'pendente') => void
    deliveryCounts: {
        todos: number
        entregue: number
        pendente: number
        cancelada: number
    }
    paymentCounts: {
        todos: number
        pago: number
        parcial: number
        pendente: number
    }
}

export function VendasFilters({
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    pagamentoFilter,
    setPagamentoFilter,
    deliveryCounts,
    paymentCounts
}: VendasFiltersProps) {
    return (
        <div className="mb-6 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Buscar por cliente ou ID…"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-2 focus:ring-ring shadow-card transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="space-y-3 pb-2">
                {/* Delivery Filters */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Truck className="h-4 w-4" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 flex-1 w-full min-w-0 pr-4 -mr-4">
                        <Badge
                            variant={statusFilter === 'todos' ? 'primary' : 'gray'}
                            onClick={() => setStatusFilter('todos')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{deliveryCounts.todos}</span> Todas
                        </Badge>
                        <Badge
                            variant={statusFilter === 'entregue' ? 'success' : 'gray'}
                            onClick={() => setStatusFilter('entregue')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{deliveryCounts.entregue}</span> Entregues
                        </Badge>
                        <Badge
                            variant={statusFilter === 'pendente' ? 'warning' : 'gray'}
                            onClick={() => setStatusFilter('pendente')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{deliveryCounts.pendente}</span> Pendentes
                        </Badge>
                        <Badge
                            variant={statusFilter === 'cancelada' ? 'danger' : 'gray'}
                            onClick={() => setStatusFilter('cancelada')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{deliveryCounts.cancelada}</span> Canceladas
                        </Badge>
                    </div>
                </div>

                {/* Payment Filters */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-success/10 text-success">
                        <DollarSign className="h-4 w-4" />
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 flex-1 w-full min-w-0 pr-4 -mr-4">
                        <Badge
                            variant={pagamentoFilter === 'todos' ? 'primary' : 'gray'}
                            onClick={() => setPagamentoFilter('todos')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{paymentCounts.todos}</span> Ver todas
                        </Badge>
                        <Badge
                            variant={pagamentoFilter === 'pago' ? 'success' : 'gray'}
                            onClick={() => setPagamentoFilter('pago')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{paymentCounts.pago}</span> Quitados
                        </Badge>
                        <Badge
                            variant={pagamentoFilter === 'parcial' ? 'warning' : 'gray'}
                            onClick={() => setPagamentoFilter('parcial')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{paymentCounts.parcial}</span> Parciais
                        </Badge>
                        <Badge
                            variant={pagamentoFilter === 'pendente' ? 'danger' : 'gray'}
                            onClick={() => setPagamentoFilter('pendente')}
                            className="cursor-pointer whitespace-nowrap px-3 py-1.5 flex items-center gap-2"
                        >
                            <span className="opacity-70">{paymentCounts.pendente}</span> Pendentes
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    )
}
