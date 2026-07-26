import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { Button } from '@/components/ui'
import { formatDate, formatCurrency, cn } from '@mont/shared'
import { FORMA_PAGAMENTO_LABELS } from '@/constants'
import { getVendaBadgeStatus } from '@/utils/vendaBadge'
import type { DomainVenda } from '@/types/domain'
import { useColumnSizing } from '@/hooks/useColumnSizing'

function EntregaBadge({ status }: { status: DomainVenda['status'] }) {
    if (status === 'entregue') return <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Entregue</span>
    if (status === 'cancelada') return <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>Cancelada</span>
    return <span className={cn(badgeBase, 'bg-warning/10 text-warning-strong border-warning/20')}>Pendente</span>
}

// Reusa a MESMA lógica de status do mobile (getVendaBadgeStatus); só o mapa kind→visual é local ao desktop.
function PagamentoBadge({ venda }: { venda: DomainVenda }) {
    const s = getVendaBadgeStatus(venda)
    let text = 'Pendente'
    let cls = 'bg-warning/10 text-warning-strong border-warning/20'
    switch (s.kind) {
        case 'pago': text = 'Pago'; cls = 'bg-success/10 text-success border-success/20'; break
        case 'vencido': text = `Vencido (${s.diasAtraso}d)`; cls = 'bg-destructive/10 text-destructive border-destructive/20'; break
        case 'vence_hoje': text = 'Vence hoje'; cls = 'bg-warning-strong/10 text-warning-strong border-warning-strong/20'; break
        case 'proximo_vencimento': text = `Vence em ${s.dias}d`; cls = 'bg-warning/10 text-warning-strong border-warning/20'; break
        case 'a_receber_futuro': text = 'A Receber'; cls = 'bg-foreground/5 text-foreground/80 border-foreground/20'; break
        case 'brinde': text = 'Brinde'; cls = 'bg-muted text-muted-foreground border-border'; break
    }
    return <span className={cn(badgeBase, cls)}>{text}</span>
}

interface VendasDataGridProps {
    vendas: DomainVenda[]
    onDeleteClick: (id: string) => void
}

export function VendasDataGrid({ vendas, onDeleteClick }: VendasDataGridProps) {
    const navigate = useNavigate()
    const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }])
    const [colSizing, setColSizing] = useColumnSizing('grid-vendas')

    const columns = useMemo<ColumnDef<DomainVenda>[]>(() => [
        {
            id: 'cliente',
            accessorFn: (v) => v.contato?.nome ?? 'Cliente Não Identificado',
            size: 260,
            minSize: 180,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{row.original.contato?.nome ?? 'Cliente Não Identificado'}</div>
                    <div className="text-xs text-muted-foreground font-mono">#{row.original.id.slice(0, 8)}</div>
                </div>
            ),
        },
        {
            accessorKey: 'data',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Data" />,
            cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{formatDate(row.original.data)}</span>,
        },
        {
            accessorKey: 'formaPagamento',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Forma" />,
            cell: ({ row }) => <span className="text-muted-foreground">{FORMA_PAGAMENTO_LABELS[row.original.formaPagamento] ?? row.original.formaPagamento}</span>,
        },
        {
            id: 'itens',
            accessorFn: (v) => v.itens.length,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Itens" />,
            cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.itens.length}</span>,
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Entrega" />,
            cell: ({ row }) => <EntregaBadge status={row.original.status} />,
        },
        {
            id: 'pagamento',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Pagamento" />,
            cell: ({ row }) => <PagamentoBadge venda={row.original} />,
        },
        {
            accessorKey: 'total',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <span className="font-bold font-mono tabular-nums text-primary whitespace-nowrap">{formatCurrency(row.original.total)}</span>,
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
                row.original.status !== 'cancelada' && row.original.origem !== 'catalogo' ? (
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir venda"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); onDeleteClick(row.original.id) }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                ) : null
            ),
            meta: { headerClassName: 'w-12', cellClassName: 'w-12' },
        },
    ], [onDeleteClick])

    const table = useReactTable({
        data: vendas,
        columns,
        state: { sorting, columnSizing: colSizing },
        onSortingChange: setSorting,
        onColumnSizingChange: setColSizing,
        defaultColumn: { minSize: 80 },
        getRowId: (v) => v.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={vendas.length}
            onRowClick={(v) => navigate(`/vendas/${v.id}`)}
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
