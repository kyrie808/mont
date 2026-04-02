import { ShoppingCart } from 'lucide-react'
import { EmptyState, Button, Pagination } from '../../../components/ui'
import { VendaCard } from './VendaCard'
import { useNavigate } from 'react-router-dom'

import type { DomainVenda } from '../../../types/domain'

interface VendasListProps {
    vendas: DomainVenda[]
    filteredCount: number
    currentPage: number
    pageSize: number
    onPageChange: (page: number) => void
    onDeleteClick: (id: string) => void
}

export function VendasList({
    vendas,
    filteredCount,
    currentPage,
    pageSize,
    onPageChange,
    onDeleteClick
}: VendasListProps) {
    const navigate = useNavigate()

    if (vendas.length === 0) {
        return (
            <EmptyState
                icon={<ShoppingCart className="h-12 w-12 text-gray-400" />}
                title="Nenhuma venda encontrada"
                description="Tente ajustar os filtros ou crie uma nova venda."
                action={
                    <Button onClick={() => navigate('/nova-venda')}>
                        Nova Venda
                    </Button>
                }
            />
        )
    }

    return (
        <>
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                {vendas.map((venda) => (
                    <VendaCard 
                        key={venda.id} 
                        venda={venda} 
                        onDeleteClick={onDeleteClick} 
                    />
                ))}
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredCount}
                pageSize={pageSize}
                onPageChange={onPageChange}
            />
        </>
    )
}
