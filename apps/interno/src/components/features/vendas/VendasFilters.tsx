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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por cliente ou ID..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border-gray-200 dark:border-border dark:bg-muted/50 focus:border-primary-500 focus:ring-primary-500 shadow-sm transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="space-y-3 pb-2">
                {/* Delivery Filters */}
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400">
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
                    <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
