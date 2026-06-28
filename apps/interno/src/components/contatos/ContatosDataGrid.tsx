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
import { MessageCircle, Store, User } from 'lucide-react'
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { badgeBase } from '@/components/reui/data-grid/badge-base'
import { Button } from '@/components/ui'
import { formatDate, cn } from '@mont/shared'
import type { DomainContato } from '@/types/domain'

// Mesma semântica de cor do ContatoCard (statusConfig) — tokens, nunca cor crua.
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    cliente: { label: 'Cliente', cls: 'bg-success/10 text-success border-success/20' },
    lead: { label: 'Lead', cls: 'bg-warning/10 text-warning-strong border-warning/20' },
    inativo: { label: 'Inativo', cls: 'bg-muted text-muted-foreground border-border' },
    fornecedor: { label: 'Fornecedor', cls: 'bg-foreground/5 text-foreground/80 border-foreground/20' },
}

function StatusBadge({ status }: { status: DomainContato['status'] }) {
    const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.cliente
    return <span className={cn(badgeBase, s.cls)}>{s.label}</span>
}

function TipoBadge({ tipo }: { tipo: DomainContato['tipo'] }) {
    const Icon = tipo === 'B2B' ? Store : User
    return (
        <span className={cn(badgeBase, 'bg-muted text-muted-foreground border-border')}>
            <Icon className="size-3.5" />
            {tipo}
        </span>
    )
}

// Mesma regra do ContatoCard: telefone só-dígitos → wa.me/55…
function abrirWhatsapp(telefone: string) {
    const phone = telefone.replace(/\D/g, '')
    window.open(`https://wa.me/55${phone}`, '_blank')
}

interface ContatosDataGridProps {
    contatos: DomainContato[]
}

export function ContatosDataGrid({ contatos }: ContatosDataGridProps) {
    const navigate = useNavigate()
    const [sorting, setSorting] = useState<SortingState>([{ id: 'nome', desc: false }])

    const columns = useMemo<ColumnDef<DomainContato>[]>(() => [
        {
            accessorKey: 'nome',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Cliente" />,
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{row.original.nome}</div>
                    {row.original.apelido && (
                        <div className="text-xs text-muted-foreground truncate">{row.original.apelido}</div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'telefone',
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Telefone" />,
            cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{row.original.telefone}</span>,
        },
        {
            accessorKey: 'tipo',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => <TipoBadge tipo={row.original.tipo} />,
        },
        {
            accessorKey: 'status',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
            cell: ({ row }) => <StatusBadge status={row.original.status} />,
        },
        {
            id: 'cidade',
            accessorFn: (c) => [c.cidade, c.uf].filter(Boolean).join('/'),
            enableSorting: false,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Cidade/UF" />,
            cell: ({ row }) => {
                const local = [row.original.cidade, row.original.uf].filter(Boolean).join('/')
                return <span className="text-muted-foreground whitespace-nowrap">{local || '—'}</span>
            },
        },
        {
            accessorKey: 'criadoEm',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Cadastro" />,
            cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{formatDate(row.original.criadoEm)}</span>,
        },
        {
            id: 'acoes',
            enableSorting: false,
            header: () => <span className="sr-only">Ações</span>,
            cell: ({ row }) => (
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Abrir WhatsApp"
                    className="h-8 w-8 text-success/70 hover:text-success hover:bg-success/10"
                    onClick={(e) => { e.stopPropagation(); abrirWhatsapp(row.original.telefone) }}
                >
                    <MessageCircle className="h-4 w-4" />
                </Button>
            ),
            meta: { headerClassName: 'w-12', cellClassName: 'w-12' },
        },
    ], [])

    const table = useReactTable({
        data: contatos,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getRowId: (c) => c.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    })

    return (
        <DataGrid
            table={table}
            recordCount={contatos.length}
            onRowClick={(c) => navigate(`/contatos/${c.id}`)}
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
