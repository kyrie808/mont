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
import { formatCurrency, formatDate, formatPhone, cn } from '@mont/shared'
import type { DomainContato } from '@/types/domain'
import type { ContatoResumo } from '@/hooks/useContatosResumo'
import { classificarContato, SEGMENTO_BADGE, type SegmentoCliente } from '@/utils/segmentoCliente'
import { origemBadge } from '@/utils/origemContato'
import { temperaturaCliente, TEMPERATURA_BADGE, TEMPERATURA_ORDEM, type RitmoCliente } from '@/utils/temperaturaCliente'
import { useColumnSizing } from '@/hooks/useColumnSizing'

function SegmentoBadge({ segmento }: { segmento: SegmentoCliente }) {
    const s = SEGMENTO_BADGE[segmento]
    return <span className={cn(badgeBase, s.cls)}>{s.label}</span>
}

function TemperaturaBadge({ ritmo }: { ritmo: RitmoCliente | undefined }) {
    const t = TEMPERATURA_BADGE[temperaturaCliente(ritmo).estado]
    return <span className={cn(badgeBase, t.cls)}>{t.label}</span>
}

function OrigemBadge({ origem, fonte }: { origem: string; fonte?: string | null }) {
    const o = origemBadge(origem, fonte)
    return <span className={cn(badgeBase, o.cls)}>{o.label}</span>
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
    resumo: ReadonlyMap<string, ContatoResumo>
    ritmo: ReadonlyMap<string, RitmoCliente>
}

export function ContatosDataGrid({ contatos, resumo, ritmo }: ContatosDataGridProps) {
    const navigate = useNavigate()
    const [sorting, setSorting] = useState<SortingState>([{ id: 'nome', desc: false }])
    const [colSizing, setColSizing] = useColumnSizing('grid-contatos')

    const columns = useMemo<ColumnDef<DomainContato>[]>(() => [
        {
            accessorKey: 'nome',
            size: 240,
            minSize: 180,
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
            cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{formatPhone(row.original.telefone)}</span>,
        },
        {
            accessorKey: 'tipo',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => <TipoBadge tipo={row.original.tipo} />,
        },
        {
            id: 'origem',
            accessorFn: (c) => origemBadge(c.origem, c.fonte).label,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Origem" />,
            cell: ({ row }) => <OrigemBadge origem={row.original.origem} fonte={row.original.fonte} />,
        },
        {
            id: 'segmento',
            accessorFn: (c) => SEGMENTO_BADGE[classificarContato(c, resumo.get(c.id))].label,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Segmento" />,
            cell: ({ row }) => <SegmentoBadge segmento={classificarContato(row.original, resumo.get(row.original.id))} />,
        },
        {
            id: 'temperatura',
            // ordena frio→morno→quente→novo (mais acionável primeiro)
            accessorFn: (c) => TEMPERATURA_ORDEM[temperaturaCliente(ritmo.get(c.id)).estado],
            header: ({ column }) => <DataGridColumnHeader column={column} title="Temperatura" />,
            cell: ({ row }) => <TemperaturaBadge ritmo={ritmo.get(row.original.id)} />,
        },
        {
            id: 'compras',
            accessorFn: (c) => resumo.get(c.id)?.totalCompras ?? 0,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Compras" />,
            cell: ({ row }) => {
                const n = resumo.get(row.original.id)?.totalCompras ?? 0
                return <span className={cn('tabular-nums whitespace-nowrap', n === 0 && 'text-muted-foreground')}>{n || '—'}</span>
            },
        },
        {
            id: 'totalGasto',
            accessorFn: (c) => resumo.get(c.id)?.totalGasto ?? 0,
            header: ({ column }) => <DataGridColumnHeader column={column} title="Total gasto" />,
            cell: ({ row }) => {
                const v = resumo.get(row.original.id)?.totalGasto ?? 0
                return <span className={cn('tabular-nums whitespace-nowrap font-medium', v === 0 ? 'text-muted-foreground' : 'text-foreground')}>{v > 0 ? formatCurrency(v) : '—'}</span>
            },
        },
        {
            id: 'ultimaCompra',
            accessorFn: (c) => resumo.get(c.id)?.ultimaCompra ?? '',
            header: ({ column }) => <DataGridColumnHeader column={column} title="Última compra" />,
            cell: ({ row }) => {
                const d = resumo.get(row.original.id)?.ultimaCompra
                return <span className="text-muted-foreground whitespace-nowrap">{d ? formatDate(d) : '—'}</span>
            },
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
            enableResizing: false,
            size: 56,
            minSize: 56,
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
    ], [resumo, ritmo])

    const table = useReactTable({
        data: contatos,
        columns,
        state: { sorting, columnSizing: colSizing },
        onSortingChange: setSorting,
        onColumnSizingChange: setColSizing,
        defaultColumn: { minSize: 80 },
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
