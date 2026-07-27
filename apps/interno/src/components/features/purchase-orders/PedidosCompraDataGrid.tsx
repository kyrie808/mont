import { useMemo, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    getExpandedRowModel,
    type ColumnDef,
    type SortingState,
    type ExpandedState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { Button } from '@/components/ui'
import { formatCurrency, formatDate, cn } from '@mont/shared'
import type { DomainPurchaseOrderWithItems, PurchaseOrderStatus, PurchaseOrderPaymentStatus } from '@/types/domain'
import { PurchaseOrderDetail } from './PurchaseOrderDetail'
import { useColumnSizing } from '@/hooks/useColumnSizing'

function RecebimentoBadge({ status }: { status: PurchaseOrderStatus }) {
    if (status === 'received') return <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Recebido</span>
    if (status === 'cancelled') return <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>Cancelado</span>
    return <span className={cn(badgeBase, 'bg-warning/10 text-warning-strong border-warning/20')}>Pendente</span>
}

function PagamentoBadge({ status }: { status: PurchaseOrderPaymentStatus }) {
    if (status === 'paid') return <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Pago</span>
    if (status === 'partial') return <span className={cn(badgeBase, 'bg-warning/10 text-warning-strong border-warning/20')}>Parcial</span>
    return <span className={cn(badgeBase, 'bg-destructive/10 text-destructive border-destructive/20')}>Em Aberto</span>
}

interface PedidosCompraDataGridProps {
    orders: DomainPurchaseOrderWithItems[]
    onEdit: (order: DomainPurchaseOrderWithItems) => void
    onDeletePayment: (paymentId: string) => void
    onConfirmReceipt: (order: DomainPurchaseOrderWithItems) => void
    onQuitar: (order: DomainPurchaseOrderWithItems) => void
}

export function PedidosCompraDataGrid({ orders, onEdit, onDeletePayment, onConfirmReceipt, onQuitar }: PedidosCompraDataGridProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'orderDate', desc: true }])
    const [expanded, setExpanded] = useState<ExpandedState>({})
    const [colSizing, setColSizing] = useColumnSizing('grid-pedidos-compra')

    const columns = useMemo<ColumnDef<DomainPurchaseOrderWithItems>[]>(() => [
        {
            id: 'expander',
            enableSorting: false,
            enableResizing: false,
            size: 40,
            minSize: 40,
            header: () => <span className="sr-only">Expandir</span>,
            cell: ({ row }) => (
                <span className="flex items-center justify-center text-muted-foreground">
                    {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
            ),
            meta: { headerClassName: 'w-8', cellClassName: 'w-8' },
        },
        {
            accessorKey: 'orderDate',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Data" />,
            cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{formatDate(row.original.orderDate)}</span>,
        },
        {
            id: 'fornecedor',
            accessorFn: (o) => o.fornecedor?.nome ?? 'Fornecedor não informado',
            size: 240,
            minSize: 160,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Fornecedor" />,
            cell: ({ row }) => (
                <span className="font-semibold text-foreground truncate">{row.original.fornecedor?.nome ?? 'Fornecedor não informado'}</span>
            ),
        },
        {
            id: 'itens',
            accessorFn: (o) => o.items?.length ?? 0,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Itens" />,
            cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.items?.length ?? 0}</span>,
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Recebimento" />,
            cell: ({ row }) => <RecebimentoBadge status={row.original.status} />,
        },
        {
            accessorKey: 'paymentStatus',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Pagamento" />,
            cell: ({ row }) => <PagamentoBadge status={row.original.paymentStatus} />,
        },
        {
            accessorKey: 'totalAmount',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <span className="font-bold font-mono tabular-nums text-primary whitespace-nowrap">{formatCurrency(row.original.totalAmount)}</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'emAberto',
            accessorFn: (o) => o.totalAmount - o.amountPaid,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Em Aberto" />,
            cell: ({ row }) => {
                const aberto = row.original.totalAmount - row.original.amountPaid
                return <span className={cn('font-mono tabular-nums whitespace-nowrap', aberto > 0 ? 'text-warning-strong' : 'text-muted-foreground')}>{formatCurrency(aberto)}</span>
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'acoes',
            enableSorting: false,
            enableResizing: false,
            size: 56,
            minSize: 56,
            header: () => <span className="sr-only">Ações</span>,
            cell: ({ row }) => (
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar pedido"
                    title="Editar"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={(e) => { e.stopPropagation(); onEdit(row.original) }}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
            meta: {
                headerClassName: 'w-12 text-right',
                cellClassName: 'w-12 text-right',
                expandedContent: (order) => (
                    <div className="bg-muted/20">
                        <PurchaseOrderDetail
                            order={order}
                            onDeletePayment={onDeletePayment}
                            onConfirmReceipt={onConfirmReceipt}
                            onQuitar={onQuitar}
                        />
                    </div>
                ),
            },
        },
    ], [onEdit, onDeletePayment, onConfirmReceipt, onQuitar])

    const table = useReactTable({
        data: orders,
        columns,
        state: { sorting, expanded, columnSizing: colSizing },
        onSortingChange: setSorting,
        onExpandedChange: setExpanded,
        onColumnSizingChange: setColSizing,
        defaultColumn: { minSize: 80 },
        getRowCanExpand: () => true,
        getRowId: (o) => o.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={orders.length}
            onRowClick={(o) => setExpanded((prev) => {
                const map = typeof prev === 'boolean' ? {} : prev
                return { ...map, [o.id]: !map[o.id] }
            })}
            tableLayout={{ rowBorder: true, headerBorder: true, headerBackground: true, headerSticky: false, columnsResizable: true }}
            tableClassNames={{ bodyRow: 'cursor-pointer' }}
        >
            <div className="space-y-3">
                <DataGridContainer className="overflow-x-auto">
                    <DataGridTable />
                </DataGridContainer>
                <DataGridPagination />
            </div>
        </DataGrid>
    )
}
