import { useMemo, useState } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { Package } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { formatCurrency, cn } from '@mont/shared'
import type { DomainProduto } from '@/types/domain'
import { estoqueStatus, ESTOQUE_STATUS_BADGE } from '@/utils/estoqueStatus'

// Mesma regra de margem da página (calcularMargem): (preco - custo) / preco.
function margemPct(preco: number, custo: number): number {
    if (preco === 0) return 0
    return ((preco - custo) / preco) * 100
}

// Mostra o saldo numérico, colorido pela MESMA regra/cores da página Estoque
// (negativo = vermelho, zerado = neutro, baixo = amarelo, ok = verde). Inativo = neutro.
function EstoqueBadge({ produto }: { produto: DomainProduto }) {
    const cls = produto.ativo
        ? ESTOQUE_STATUS_BADGE[estoqueStatus(produto)].cls
        : 'bg-muted text-muted-foreground border-border'
    return (
        <span className={cn(badgeBase, cls)} title={`Mínimo: ${produto.estoqueMinimo}`}>
            {produto.estoqueAtual}
        </span>
    )
}

interface ProdutosDataGridProps {
    produtos: DomainProduto[]
    onEdit: (produto: DomainProduto) => void
}

export function ProdutosDataGrid({ produtos, onEdit }: ProdutosDataGridProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'nome', desc: false }])

    const columns = useMemo<ColumnDef<DomainProduto>[]>(() => [
        {
            accessorKey: 'nome',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Produto" />,
            cell: ({ row }) => {
                const p = row.original
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-md bg-muted shrink-0 overflow-hidden border border-border flex items-center justify-center">
                            {p.imagemUrl ? (
                                <img src={p.imagemUrl} alt={p.nome} className="h-full w-full object-cover" />
                            ) : (
                                <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn('font-semibold truncate', !p.ativo && 'text-muted-foreground')}>{p.nome}</span>
                                {p.ehCombo && (
                                    <span className={cn(badgeBase, 'bg-primary/10 text-primary border-primary/20')}>Combo</span>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">#{p.codigo}</div>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'preco',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Preço" />,
            cell: ({ row }) => <span className="font-bold font-mono tabular-nums text-primary whitespace-nowrap">{formatCurrency(row.original.preco)}</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            accessorKey: 'custo',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Custo" />,
            cell: ({ row }) => <span className="text-muted-foreground font-mono tabular-nums whitespace-nowrap">{formatCurrency(row.original.custo)}</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            id: 'margem',
            accessorFn: (p) => margemPct(p.preco, p.custo),
            header: ({ column }) => <DataGridColumnHeader column={column} title="Margem" />,
            cell: ({ row }) => <span className="text-muted-foreground tabular-nums whitespace-nowrap">{margemPct(row.original.preco, row.original.custo).toFixed(0)}%</span>,
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        },
        {
            accessorKey: 'estoqueAtual',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Estoque" />,
            cell: ({ row }) => <EstoqueBadge produto={row.original} />,
        },
        {
            accessorKey: 'ativo',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
            cell: ({ row }) => (
                row.original.ativo
                    ? <span className={cn(badgeBase, 'bg-success/10 text-success border-success/20')}>Ativo</span>
                    : <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>Inativo</span>
            ),
        },
    ], [])

    const table = useReactTable({
        data: produtos,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
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
            onRowClick={(p) => onEdit(p)}
            tableLayout={{ rowBorder: true, headerBorder: true, headerBackground: true, headerSticky: false }}
            tableClassNames={{ bodyRow: 'cursor-pointer' }}
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
