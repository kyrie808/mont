import { useMemo, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { Button } from '@/components/ui'
import { cn } from '@mont/shared'
import type { DomainProduto } from '@/types/domain'
import { estoqueStatus, ESTOQUE_STATUS_BADGE, type EstoqueStatus } from '@/utils/estoqueStatus'
import { useColumnSizing } from '@/hooks/useColumnSizing'

// Re-export: fonte única em utils/estoqueStatus (mantém imports antigos deste módulo).
export { estoqueStatus, type EstoqueStatus }

function StatusBadge({ status }: { status: EstoqueStatus }) {
    const { label, cls } = ESTOQUE_STATUS_BADGE[status]
    return <span className={cn(badgeBase, cls)}>{label}</span>
}

interface EstoqueDataGridProps {
    produtos: DomainProduto[]
    onAjustar: (produto: DomainProduto) => void
}

export function EstoqueDataGrid({ produtos, onAjustar }: EstoqueDataGridProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'atual', desc: false }])
    const [colSizing, setColSizing] = useColumnSizing('grid-estoque')

    const columns = useMemo<ColumnDef<DomainProduto>[]>(() => [
        {
            id: 'produto',
            accessorFn: (p) => p.nome,
            size: 300,
            minSize: 200,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Produto" />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{row.original.nome}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{row.original.codigo}</div>
                </div>
            ),
        },
        {
            id: 'atual',
            accessorFn: (p) => p.estoqueAtual ?? 0,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Atual" />,
            cell: ({ row }) => {
                const atual = row.original.estoqueAtual ?? 0
                return <span className={cn('font-bold font-mono tabular-nums', atual < 0 ? 'text-destructive' : 'text-foreground')}>{atual}</span>
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'minimo',
            accessorFn: (p) => p.estoqueMinimo ?? 0,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Mínimo" />,
            cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.estoqueMinimo ?? 0}</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'status',
            accessorFn: (p) => estoqueStatus(p),
            header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
            cell: ({ row }) => <StatusBadge status={estoqueStatus(row.original)} />,
        },
        {
            id: 'acoes',
            enableSorting: false,
            enableResizing: false,
            size: 120,
            minSize: 120,
            header: () => <span className="sr-only">Ações</span>,
            cell: ({ row }) => (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                    onClick={() => onAjustar(row.original)}
                >
                    Ajustar
                </Button>
            ),
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
    ], [onAjustar])

    const table = useReactTable({
        data: produtos,
        columns,
        state: { sorting, columnSizing: colSizing },
        onSortingChange: setSorting,
        onColumnSizingChange: setColSizing,
        defaultColumn: { minSize: 80 },
        getRowId: (p) => p.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={produtos.length}
            tableLayout={{ rowBorder: true, headerBorder: true, headerBackground: true, headerSticky: false, columnsResizable: true }}
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
