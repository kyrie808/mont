import { useMemo, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { formatCurrency, cn } from '@mont/shared'
import { format } from 'date-fns'
import type { ExtratoItem } from '@mont/shared'

const badgeBase = 'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap'

// A view_extrato_mensal usa tipo ∈ {entrada, saida, transferencia} (NÃO receita/despesa).
function TipoBadge({ tipo }: { tipo: ExtratoItem['tipo'] }) {
    if (tipo === 'entrada') return <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Entrada</span>
    if (tipo === 'saida') return <span className={cn(badgeBase, 'bg-destructive/10 text-destructive border-destructive/20')}>Saída</span>
    return <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>Transferência</span>
}

interface ExtratoDataGridProps {
    extrato: ExtratoItem[]
}

export function ExtratoDataGrid({ extrato }: ExtratoDataGridProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }])

    const columns = useMemo<ColumnDef<ExtratoItem>[]>(() => [
        {
            accessorKey: 'data',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Data" />,
            cell: ({ row }) => (
                <span className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {row.original.data ? format(new Date(row.original.data + 'T12:00:00'), 'dd/MM/yyyy') : '—'}
                </span>
            ),
            meta: { headerClassName: 'w-28', cellClassName: 'w-28' },
        },
        {
            id: 'descricao',
            accessorFn: (i) => i.descricao ?? '',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Descrição" />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{row.original.descricao || 'Lançamento'}</div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">{row.original.origem}</div>
                </div>
            ),
        },
        {
            id: 'categoria',
            accessorFn: (i) => i.categoria_nome ?? '',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Categoria" />,
            cell: ({ row }) => (
                <span className={cn(badgeBase, 'bg-card text-muted-foreground border-border')}>
                    {row.original.categoria_nome || 'Lançamento'}
                </span>
            ),
        },
        {
            accessorKey: 'tipo',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => <TipoBadge tipo={row.original.tipo} />,
        },
        {
            accessorKey: 'valor',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Valor" />,
            cell: ({ row }) => {
                const tipo = row.original.tipo
                const valor = row.original.valor || 0
                return (
                    <span className={cn(
                        'font-bold font-mono tabular-nums whitespace-nowrap',
                        tipo === 'entrada' ? 'text-success' : tipo === 'saida' ? 'text-destructive' : 'text-foreground'
                    )}>
                        {tipo === 'saida' ? '- ' : tipo === 'entrada' ? '+ ' : ''}{formatCurrency(valor)}
                    </span>
                )
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
    ], [])

    const table = useReactTable({
        data: extrato,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        // id da view pode repetir entre origens (e ser null) → prefixa origem e cai no
        // índice quando não há id, garantindo unicidade estável da linha.
        getRowId: (i, index) => (i.id ? `${i.origem ?? 'x'}:${i.id}` : `row-${index}`),
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={extrato.length}
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
