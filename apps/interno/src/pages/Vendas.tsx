import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { PageContainer } from '../components/layout/PageContainer'
import { PageSkeleton, paginateArray } from '../components/ui'
import { useVendas } from '../hooks/useVendas'
import { useDashboardFilter } from '../hooks/useDashboardFilter'
import { useDebounce } from '../hooks/useDebounce'

// Sub-components
import { VendasFilters } from '../components/features/vendas/VendasFilters'
import { VendasList } from '../components/features/vendas/VendasList'
import { VendaModais } from '../components/features/vendas/VendaModais'

type StatusFilter = 'todos' | 'pendente' | 'entregue' | 'cancelada'
type PagamentoFilter = 'todos' | 'pago' | 'parcial' | 'pendente'

export function Vendas() {
    const { openDrawer } = useNavigationStore()
    const [searchParams, setSearchParams] = useSearchParams()
    const { startDate, endDate } = useDashboardFilter()
    const statusFilter = searchParams.get('status') as StatusFilter | null
    const pagamentoFilter = searchParams.get('pagamento') as PagamentoFilter | null

    const setStatusFilter = (val: StatusFilter) => {
        const newParams = new URLSearchParams(searchParams)
        if (val === newParams.get('status')) newParams.delete('status')
        else newParams.set('status', val)
        newParams.delete('pagamento')
        setSearchParams(newParams)
        setCurrentPage(1)
    }

    const setPagamentoFilter = (val: PagamentoFilter) => {
        const newParams = new URLSearchParams(searchParams)
        if (val === newParams.get('pagamento')) newParams.delete('pagamento')
        else newParams.set('pagamento', val)
        newParams.delete('status')
        setSearchParams(newParams)
        setCurrentPage(1)
    }

    const [searchTerm, setSearchTerm] = useState('')
    const debouncedSearchTerm = useDebounce(searchTerm, 500)
    const { vendas, loading, deleteVenda } = useVendas({ startDate, endDate, includePending: true, search: debouncedSearchTerm })
    
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [vendaToDelete, setVendaToDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 25

    const filteredVendas = useMemo(() => {
        if (!statusFilter && !pagamentoFilter && !debouncedSearchTerm) return vendas
        return vendas.filter(venda => {
            if (statusFilter && statusFilter !== 'todos' && venda.status !== statusFilter) return false
            if (pagamentoFilter && pagamentoFilter !== 'todos') {
                const isPaid = venda.pago || venda.valorPago >= venda.total
                const isPartial = !isPaid && venda.valorPago > 0 && venda.valorPago < venda.total
                const isPending = !isPaid && venda.valorPago === 0
                if (pagamentoFilter === 'pago' && !isPaid) return false
                if (pagamentoFilter === 'parcial' && !isPartial) return false
                if (pagamentoFilter === 'pendente' && !isPending) return false
            }
            return true
        })
    }, [vendas, statusFilter, pagamentoFilter, debouncedSearchTerm])

    // We can remove the useEffect and just handle reset in the filters
    // useEffect(() => {
    //     setCurrentPage(1)
    // }, [statusFilter, pagamentoFilter, debouncedSearchTerm])

    const isInDateRange = useCallback((dateStr: string) => {
        if (!startDate || !endDate) return true
        const d = new Date(dateStr + 'T12:00:00'), start = new Date(startDate), end = new Date(endDate)
        start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999)
        return d >= start && d <= end
    }, [startDate, endDate])

    const deliveryCounts = useMemo(() => ({
        todos: vendas.filter(v => isInDateRange(v.data)).length,
        entregue: vendas.filter(v => v.status === 'entregue' && isInDateRange(v.data)).length,
        pendente: vendas.filter(v => v.status === 'pendente').length,
        cancelada: vendas.filter(v => v.status === 'cancelada' && isInDateRange(v.data)).length
    }), [vendas, isInDateRange])

    const paymentCounts = useMemo(() => ({
        todos: vendas.filter(v => isInDateRange(v.data)).length,
        pago: vendas.filter(v => (v.pago || v.valorPago >= v.total) && isInDateRange(v.data)).length,
        parcial: vendas.filter(v => !v.pago && v.valorPago > 0 && v.valorPago < v.total && isInDateRange(v.data)).length,
        pendente: vendas.filter(v => !v.pago && v.valorPago === 0).length
    }), [vendas, isInDateRange])

    const handleDelete = async () => {
        if (!vendaToDelete) return
        setIsDeleting(true)
        if (await deleteVenda(vendaToDelete)) setShowDeleteModal(false)
        setIsDeleting(false)
    }

    if (loading) return <PageSkeleton rows={8} showHeader showCards={false} />

    return (
        <>
            <Header title="Vendas" showMenu centerTitle onMenuClick={openDrawer} />
                <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                    <VendasFilters
                        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                        pagamentoFilter={pagamentoFilter} setPagamentoFilter={setPagamentoFilter}
                        deliveryCounts={deliveryCounts} paymentCounts={paymentCounts}
                    />
                    <VendasList
                        vendas={paginateArray(filteredVendas, currentPage, PAGE_SIZE)}
                        filteredCount={filteredVendas.length}
                        currentPage={currentPage} pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                        onDeleteClick={(id) => { setVendaToDelete(id); setShowDeleteModal(true); }}
                    />
                </PageContainer>
            <VendaModais
                showDeleteModal={showDeleteModal} setShowDeleteModal={setShowDeleteModal}
                handleDelete={handleDelete} isDeleting={isDeleting}
            />
        </>
    )
}
