import { ShoppingCart } from 'lucide-react'
import { EmptyState, Button, Pagination } from '../../../components/ui'
import { VendaCard } from './VendaCard'
import { VendasDataGrid } from './VendasDataGrid'
import { useNavigate } from 'react-router-dom'

import type { DomainVenda } from '../../../types/domain'

interface VendasListProps {
    vendas: DomainVenda[]
    allVendas: DomainVenda[]
    filteredCount: number
    currentPage: number
    pageSize: number
    onPageChange: (page: number) => void
    onDeleteClick: (id: string) => void
}

export function VendasList({
    vendas,
    allVendas,
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
                icon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
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
            {/* MOBILE (<lg): lista de cards — intocada (mobile sagrado) */}
            <div className="space-y-4 lg:hidden">
                {vendas.map((venda) => (
                    <VendaCard
                        key={venda.id}
                        venda={venda}
                        onDeleteClick={onDeleteClick}
                    />
                ))}
                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredCount}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                />
            </div>

            {/* DESKTOP (≥lg): data grid denso — sort + paginação próprios sobre o conjunto filtrado inteiro */}
            <div className="hidden lg:block">
                <VendasDataGrid vendas={allVendas} onDeleteClick={onDeleteClick} />
            </div>
        </>
    )
}
