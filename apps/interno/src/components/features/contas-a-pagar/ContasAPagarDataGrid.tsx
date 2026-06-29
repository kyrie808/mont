import { useMemo, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { DollarSign, Trash2, Pencil } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { Button } from '@/components/ui'
import { formatCurrency, formatDate, cn } from '@mont/shared'
import type { ContaAPagarEnriched } from '@/services/contasAPagarService'

function StatusBadge({ status, diasAtraso }: { status: string; diasAtraso: number }) {
    const atraso = diasAtraso > 0 ? ` (${diasAtraso}d)` : ''
    if (status === 'pago') return <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Pago</span>
    if (status === 'vencido') return <span className={cn(badgeBase, 'bg-destructive/10 text-destructive border-destructive/20')}>Vencido{atraso}</span>
    if (status === 'parcial') return <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>Parcial</span>
    return <span className={cn(badgeBase, 'bg-warning/10 text-warning-strong border-warning/20')}>Pendente</span>
}

interface ContasAPagarDataGridProps {
    contas: ContaAPagarEnriched[]
    onPay: (conta: ContaAPagarEnriched) => void
    onEdit: (conta: ContaAPagarEnriched) => void
    onDelete: (conta: ContaAPagarEnriched) => void
}

export function ContasAPagarDataGrid({ contas, onPay, onEdit, onDelete }: ContasAPagarDataGridProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'data_vencimento', desc: false }])

    const columns = useMemo<ColumnDef<ContaAPagarEnriched>[]>(() => [
        {
            id: 'credor',
            accessorFn: (c) => c.credor,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Credor" />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{row.original.credor}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.original.descricao}</div>
                </div>
            ),
        },
        {
            id: 'categoria',
            accessorFn: (c) => c.plano_de_contas?.nome ?? '',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Categoria" />,
            cell: ({ row }) => (
                <span className={cn(badgeBase, 'bg-card text-muted-foreground border-border')}>
                    {row.original.plano_de_contas?.nome || 'Sem categoria'}
                </span>
            ),
        },
        {
            accessorKey: 'data_vencimento',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Vencimento" />,
            cell: ({ row }) => (
                <span className={cn(
                    'whitespace-nowrap tabular-nums',
                    row.original.diasAtraso > 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'
                )}>
                    {formatDate(row.original.data_vencimento)}
                </span>
            ),
        },
        {
            id: 'total',
            accessorFn: (c) => c.valor_total,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Total" />,
            cell: ({ row }) => <span className="font-mono tabular-nums text-foreground whitespace-nowrap">{formatCurrency(row.original.valor_total)}</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'devedor',
            accessorFn: (c) => c.saldo_devedor ?? (c.valor_total - c.valor_pago),
            header: ({ column }) => <DataGridColumnHeader column={column} title="Devedor" />,
            cell: ({ row }) => {
                const devedor = row.original.saldo_devedor ?? (row.original.valor_total - row.original.valor_pago)
                return (
                    <span className={cn(
                        'font-bold font-mono tabular-nums whitespace-nowrap',
                        devedor > 0 ? 'text-destructive' : 'text-success'
                    )}>
                        {formatCurrency(devedor)}
                    </span>
                )
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'status',
            accessorFn: (c) => c.displayStatus,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
            cell: ({ row }) => <StatusBadge status={row.original.displayStatus} diasAtraso={row.original.diasAtraso} />,
        },
        {
            id: 'acoes',
            enableSorting: false,
            header: () => <span className="sr-only">Ações</span>,
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    {row.original.displayStatus !== 'pago' && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                            onClick={() => onPay(row.original)}
                        >
                            Pagar
                        </Button>
                    )}
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${row.original.credor}`}
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => onEdit(row.original)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Excluir ${row.original.credor}`}
                        className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(row.original)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
    ], [onPay, onEdit, onDelete])

    const table = useReactTable({
        data: contas,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getRowId: (c) => c.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={contas.length}
            tableLayout={{ rowBorder: true, headerBorder: true, headerBackground: true, headerSticky: false }}
        >
            <div className="space-y-3">
                <DataGridContainer>
                    <DataGridTable />
                </DataGridContainer>
                <DataGridPagination />
            </div>
        </DataGrid>
    )
}
