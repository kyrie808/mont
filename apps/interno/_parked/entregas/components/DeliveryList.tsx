import { Grid3x3, List, CheckSquare, X, MapPin } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DeliveryCard } from './DeliveryCard'
import { cn } from '@mont/shared'

interface DeliveryItem {
    id: string
    cliente_nome: string
    endereco: string
    bairro: string | null
    total: number
    latitude?: number | null
    longitude?: number | null
}

interface DeliveryListProps {
    deliveries: DeliveryItem[]
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
    groupByNeighborhood?: boolean
}

export function DeliveryList({
    deliveries,
    selectedIds,
    onToggleSelection,
    groupByNeighborhood = true
}: DeliveryListProps) {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

    // Group deliveries by neighborhood
    const groupedDeliveries = useMemo(() => {
        if (!groupByNeighborhood) return { 'Todos': deliveries }

        const grouped: Record<string, DeliveryItem[]> = {}
        deliveries.forEach(delivery => {
            const key = delivery.bairro || 'SEM BAIRRO'
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(delivery)
        })
        return grouped
    }, [deliveries, groupByNeighborhood])

    const handleSelectAll = () => {
        deliveries.forEach(d => {
            if (!selectedIds.has(d.id)) {
                onToggleSelection(d.id)
            }
        })
    }

    const handleClearAll = () => {
        deliveries.forEach(d => {
            if (selectedIds.has(d.id)) {
                onToggleSelection(d.id)
            }
        })
    }

    const handleSelectByNeighborhood = (bairro: string) => {
        const items = groupedDeliveries[bairro] || []
        items.forEach(d => {
            if (!selectedIds.has(d.id)) {
                onToggleSelection(d.id)
            }
        })
    }

    if (deliveries.length === 0) {
        return (
            <Card className="p-8 bg-card shadow-sm border border-border rounded-xl">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <MapPin className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma entrega pendente</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Todas as vendas foram entregues!</p>
                </div>
            </Card>
        )
    }

    return (
        <Card className="p-5 bg-card shadow-sm border border-border rounded-xl space-y-4">
            {/* Header: Stats + View Toggle */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Entregas Pendentes</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {deliveries.length} total · {selectedIds.size} selecionadas
                    </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-2 rounded transition-colors",
                            viewMode === 'grid' ? "bg-white dark:bg-gray-700 text-semantic-green shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-2 rounded transition-colors",
                            viewMode === 'list' ? "bg-white dark:bg-gray-700 text-semantic-green shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs h-8"
                >
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                    Selecionar Tudo
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-xs h-8"
                >
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Limpar
                </Button>
            </div>

            {/* Delivery List */}
            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-6">
                {Object.entries(groupedDeliveries).map(([bairro, items]) => (
                    <div key={bairro}>
                        {/* Neighborhood Header */}
                        {groupByNeighborhood && (
                            <div className="sticky top-0 bg-background z-10 pb-2 mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-semantic-green rounded-full" />
                                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                        {bairro}
                                    </h4>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        ({items.length})
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSelectByNeighborhood(bairro)}
                                    className="text-xs h-7 text-semantic-green hover:bg-semantic-green/10"
                                >
                                    Selecionar bairro
                                </Button>
                            </div>
                        )}

                        {/* Cards Grid/List */}
                        <div className={cn(
                            "gap-3",
                            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2" : "space-y-3"
                        )}>
                            {items.map(delivery => (
                                <DeliveryCard
                                    key={delivery.id}
                                    id={delivery.id}
                                    cliente={delivery.cliente_nome}
                                    endereco={delivery.endereco}
                                    bairro={delivery.bairro}
                                    total={delivery.total}
                                    isSelected={selectedIds.has(delivery.id)}
                                    hasAddress={Boolean(delivery.latitude && delivery.longitude)}
                                    onToggle={onToggleSelection}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}
