import { useState, useMemo, useEffect } from 'react'
import {
    Search,
    Filter,
    AlertCircle,
    Clock,
    CheckCircle2,
    Plus,
    DollarSign,
    CalendarDays,
    Trash2,
    Repeat,
    Pencil,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button, Badge, EmptyState, ConfirmDialog } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { ContaAPagarModal, type ContaAPagarFormData } from '../components/features/contas-a-pagar/ContaAPagarModal'
import { EditDespesaModal } from '../components/features/contas-a-pagar/EditDespesaModal'
import { PagamentoContaAPagarModal } from '../components/features/contas-a-pagar/PagamentoContaAPagarModal'
import { ContasAPagarDataGrid } from '../components/features/contas-a-pagar/ContasAPagarDataGrid'
import { useContasAPagar } from '../hooks/useContasAPagar'
import { useDespesasRecorrentes } from '../hooks/useDespesasRecorrentes'
import type { DespesaRecorrenteWithCategoria } from '../services/despesasRecorrentesService'
import { formatCurrency, formatDate } from '@mont/shared'
import { cn } from '@mont/shared'
import { MonthPicker } from '../components/dashboard/MonthPicker'
import { differenceInDays, parseISO, isBefore } from 'date-fns'
import type { ContaAPagarEnriched } from '../services/contasAPagarService'

type StatusFilter = 'todos' | 'pendentes' | 'parciais' | 'pagas' | 'vencidas'

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'default' | 'success' | 'danger' }> = {
    pendente: { label: 'Pendente', variant: 'warning' },
    parcial: { label: 'Parcial', variant: 'default' },
    pago: { label: 'Pago', variant: 'success' },
    vencido: { label: 'Vencido', variant: 'danger' },
}

export function ContasAPagar() {
    const { contasAPagar, loading, createContaAPagar, criarObrigacaoParcelada, updateContaAPagar, deleteContaAPagar, isDeleting, registrarPagamento, refetch } = useContasAPagar()
    const { recorrentes, createRecorrente, updateRecorrente, deleteRecorrente, gerarDoMes } = useDespesasRecorrentes()
    const toast = useToast()
    const [filter, setFilter] = useState<StatusFilter>('todos')
    const [searchTerm, setSearchTerm] = useState('')
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [paymentTarget, setPaymentTarget] = useState<ContaAPagarEnriched | null>(null)
    const [editTarget, setEditTarget] = useState<ContaAPagarEnriched | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ContaAPagarEnriched | null>(null)
    const [recorrenteDeleteTarget, setRecorrenteDeleteTarget] = useState<DespesaRecorrenteWithCategoria | null>(null)

    // Materializa (idempotente) as ocorrências do mês CORRENTE no load — sem cron.
    // Rodar 2× não duplica (unique recorrente_id+competencia no banco).
    useEffect(() => {
        const now = new Date()
        const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        gerarDoMes(competencia).then((n) => { if (n > 0) refetch() }).catch(() => { /* silencioso */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const MONTHS_MAP: Record<string, number> = {
        'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
        'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11,
    }
    const MONTHS_REVERSE = Object.entries(MONTHS_MAP).reduce<Record<number, string>>((acc, [k, v]) => { acc[v] = k; return acc }, {})

    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(MONTHS_REVERSE[now.getMonth()])

    const enrichedContas = useMemo<ContaAPagarEnriched[]>(() => {
        return contasAPagar.map(c => {
            const hoje = new Date()
            hoje.setHours(0, 0, 0, 0)
            const vencimento = parseISO(c.data_vencimento)
            const isVencida = c.status !== 'pago' && isBefore(vencimento, hoje)
            return {
                ...c,
                displayStatus: isVencida ? 'vencido' : c.status,
                diasAtraso: isVencida ? differenceInDays(hoje, vencimento) : 0,
            }
        })
    }, [contasAPagar])

    const filtered = useMemo(() => {
        const monthIndex = MONTHS_MAP[selectedMonth]
        const year = new Date().getFullYear()

        let result = enrichedContas
        // "Vencidas" mostra TODAS as vencidas (qualquer mês/ano) — senão contas vencidas
        // de meses/anos anteriores ficariam invisíveis e impagáveis. Os demais filtros
        // respeitam o mês selecionado (visão mensal do ano corrente).
        if (filter !== 'vencidas') {
            result = result.filter(c => {
                const d = parseISO(c.data_vencimento)
                return d.getMonth() === monthIndex && d.getFullYear() === year
            })
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(c =>
                c.credor.toLowerCase().includes(term) ||
                c.descricao.toLowerCase().includes(term) ||
                c.referencia?.toLowerCase().includes(term)
            )
        }

        if (filter === 'pendentes') result = result.filter(c => c.displayStatus === 'pendente')
        else if (filter === 'parciais') result = result.filter(c => c.displayStatus === 'parcial')
        else if (filter === 'pagas') result = result.filter(c => c.displayStatus === 'pago')
        else if (filter === 'vencidas') result = result.filter(c => c.displayStatus === 'vencido')

        return result
    }, [enrichedContas, filter, searchTerm, selectedMonth])

    const handleCreate = async (data: ContaAPagarFormData) => {
        // Despesa FIXA: cria o template recorrente e já materializa o mês corrente.
        if (data.recorrente && data.dia_vencimento != null) {
            await createRecorrente({
                descricao: data.descricao,
                credor: data.credor,
                valor: data.valor_total,
                plano_conta_id: data.plano_conta_id,
                dia_vencimento: data.dia_vencimento,
                ativa: true,
            })
            const now = new Date()
            const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
            await gerarDoMes(competencia)
            refetch()
            return
        }

        // Despesa avulsa / parcelada (comportamento original).
        const data_vencimento = data.data_vencimento ?? ''
        const totalParcelas = data.total_parcelas ?? 1

        if (totalParcelas > 1) {
            await criarObrigacaoParcelada({
                descricao: data.descricao,
                credor: data.credor,
                valor_total: data.valor_total,
                data_vencimento,
                plano_conta_id: data.plano_conta_id,
                total_parcelas: totalParcelas,
                referencia: data.referencia,
            })
        } else {
            const row = await createContaAPagar({
                descricao: data.descricao,
                credor: data.credor,
                valor_total: data.valor_total,
                data_vencimento,
                plano_conta_id: data.plano_conta_id,
                parcela_atual: 1,
                total_parcelas: 1,
                referencia: data.referencia || null,
            })

            // "Já paguei": registra a saída no caixa na hora (status → pago).
            if (data.ja_pago && data.pagamento_conta_id && data.pagamento_data) {
                await registrarPagamento({
                    contaAPagarId: row.id,
                    valor: data.valor_total,
                    dataPagamento: data.pagamento_data,
                    contaId: data.pagamento_conta_id,
                    metodoPagamento: data.pagamento_metodo,
                })
            }
        }
    }

    const handleDeleteRecorrente = async () => {
        if (!recorrenteDeleteTarget) return
        try {
            await deleteRecorrente(recorrenteDeleteTarget.id)
            toast.success('Despesa fixa removida — não será mais gerada.')
        } catch {
            toast.error('Erro ao remover despesa fixa')
        }
        setRecorrenteDeleteTarget(null)
    }

    const toggleRecorrenteAtiva = async (r: DespesaRecorrenteWithCategoria) => {
        try {
            await updateRecorrente({ id: r.id, patch: { ativa: !r.ativa } })
        } catch {
            toast.error('Erro ao atualizar despesa fixa')
        }
    }

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteContaAPagar(deleteTarget.id)
            toast.success('Despesa excluída com sucesso!')
        } catch {
            toast.error('Erro ao excluir despesa')
        }
        setDeleteTarget(null)
    }

    const deleteMessage = deleteTarget
        ? deleteTarget.valor_pago > 0
            ? 'Esta despesa já possui pagamentos registrados. Excluir mesmo assim?'
            : 'Tem certeza que deseja excluir esta despesa?'
        : ''

    return (
        <>
            <Header
                title="Despesas"
                showBack
                centerTitle
                rightAction={
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="p-2 rounded-full text-success"
                        aria-label="Nova despesa"
                    >
                        <Plus />
                    </button>
                }
            />

            <main className="max-w-5xl lg:max-w-[1500px] mx-auto p-4 pb-24 space-y-6">
                <MonthPicker selectedMonth={selectedMonth} onMonthSelect={setSelectedMonth} />

                {/* Despesas Fixas (recorrentes) — templates que geram uma conta todo mês */}
                {recorrentes.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Repeat className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-bold text-foreground">Despesas Fixas (todo mês)</h2>
                        </div>
                        <div className="space-y-2">
                            {recorrentes.map((r) => (
                                <div
                                    key={r.id}
                                    className={cn(
                                        "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 transition-opacity",
                                        !r.ativa && "opacity-50"
                                    )}
                                >
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground truncate">{r.descricao}</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {r.credor} · vence dia {r.dia_vencimento}
                                            {r.plano_de_contas?.nome ? ` · ${r.plano_de_contas.nome}` : ''}
                                            {!r.ativa ? ' · pausada' : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="font-bold text-foreground tabular-nums">{formatCurrency(r.valor)}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleRecorrenteAtiva(r)}
                                            aria-pressed={r.ativa}
                                            title={r.ativa ? 'Pausar (parar de gerar)' : 'Reativar'}
                                            className={cn(
                                                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                                                r.ativa ? "bg-primary" : "bg-muted"
                                            )}
                                        >
                                            <span className={cn(
                                                "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
                                                r.ativa ? "translate-x-5" : "translate-x-0.5"
                                            )} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRecorrenteDeleteTarget(r)}
                                            className="flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                                            aria-label={`Excluir despesa fixa ${r.descricao}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search & Filters */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar credor, descrição ou referência..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            aria-label="Buscar despesas"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {([
                            { id: 'todos', label: 'Todas', icon: Filter },
                            { id: 'vencidas', label: 'Vencidas', icon: AlertCircle },
                            { id: 'pendentes', label: 'Pendentes', icon: Clock },
                            { id: 'parciais', label: 'Parciais', icon: CalendarDays },
                            { id: 'pagas', label: 'Pagas', icon: CheckCircle2 },
                        ] as const).map((btn) => {
                            const Icon = btn.icon
                            const isSelected = filter === btn.id
                            return (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilter(btn.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold whitespace-nowrap border transition-all active:scale-95",
                                        isSelected
                                            ? "bg-foreground text-background border-foreground shadow-card"
                                            : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {btn.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div role="status" aria-live="polite" className="py-20 flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                        <p className="text-sm font-bold text-muted-foreground uppercase">Carregando despesas...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={<CheckCircle2 className="w-12 h-12" />}
                        title="Nenhuma despesa encontrada"
                        description={filter === 'todos' && !searchTerm
                            ? "Registre sua primeira despesa para começar"
                            : "Nenhum resultado para os filtros aplicados"
                        }
                        action={filter === 'todos' && !searchTerm
                            ? <Button onClick={() => setIsCreateOpen(true)}>Nova Despesa</Button>
                            : undefined
                        }
                    />
                ) : (
                    <>
                        {/* MOBILE (<lg): cards — mobile sagrado */}
                        <div className="space-y-4 lg:hidden">
                            {filtered.map((conta) => {
                                const statusInfo = STATUS_BADGE[conta.displayStatus] || STATUS_BADGE.pendente
                                const saldoDevedor = conta.saldo_devedor ?? (conta.valor_total - conta.valor_pago)
                                const percentualPago = conta.valor_total > 0
                                    ? Math.round((conta.valor_pago / conta.valor_total) * 100)
                                    : 0

                                return (
                                    <div
                                        key={conta.id}
                                        className="bg-card rounded-xl border border-border overflow-hidden shadow-card hover:shadow-elevated transition-shadow"
                                    >
                                        <div className="p-5 flex flex-col gap-4">
                                            {/* Top row */}
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-foreground leading-tight">
                                                        {conta.credor}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground mt-0.5">
                                                        {conta.descricao}
                                                    </p>
                                                    {conta.referencia && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                                                            {conta.referencia}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <Badge variant={statusInfo.variant} className="uppercase">
                                                        {statusInfo.label}
                                                        {conta.diasAtraso > 0 ? ` (${conta.diasAtraso}d)` : ''}
                                                    </Badge>
                                                    {conta.total_parcelas && conta.total_parcelas > 1 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {conta.parcela_atual}/{conta.total_parcelas}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Values + progress */}
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase block mb-0.5">Total</span>
                                                        <span className="text-base font-bold text-foreground">
                                                            {formatCurrency(conta.valor_total)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase block mb-0.5">Pago</span>
                                                        <span className="text-base font-bold text-success">
                                                            {formatCurrency(conta.valor_pago)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-muted-foreground uppercase block mb-0.5">Devedor</span>
                                                        <span className={cn(
                                                            "text-base font-bold",
                                                            saldoDevedor > 0 ? "text-destructive" : "text-success"
                                                        )}>
                                                            {formatCurrency(saldoDevedor)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Compact progress bar */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full transition-all duration-500",
                                                                percentualPago >= 100 ? "bg-success" :
                                                                percentualPago > 0 ? "bg-primary" : "bg-muted-foreground/20"
                                                            )}
                                                            style={{ width: `${Math.min(percentualPago, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                                                        {percentualPago}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Footer: vencimento + actions */}
                                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                    <span>Vencimento: <span className={cn(
                                                        "font-bold",
                                                        conta.diasAtraso > 0 && "text-destructive"
                                                    )}>{formatDate(conta.data_vencimento)}</span></span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {conta.displayStatus !== 'pago' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setPaymentTarget(conta)}
                                                            leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                                                        >
                                                            Pagar
                                                        </Button>
                                                    )}
                                                    <button
                                                        onClick={() => setEditTarget(conta)}
                                                        className="flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                                                        aria-label={`Editar despesa ${conta.credor}`}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeleteTarget(conta)}
                                                        className="flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                                                        aria-label={`Excluir despesa ${conta.credor}`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Categoria */}
                                            {conta.plano_de_contas?.nome && (
                                                <div className="text-xs text-muted-foreground">
                                                    Categoria: {conta.plano_de_contas.nome}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* DESKTOP (≥lg): Data Grid denso */}
                        <div className="hidden lg:block">
                            <ContasAPagarDataGrid
                                contas={filtered}
                                onPay={setPaymentTarget}
                                onEdit={setEditTarget}
                                onDelete={setDeleteTarget}
                            />
                        </div>
                    </>
                )}
            </main>

            {/* Modals */}
            <ContaAPagarModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSave={handleCreate}
            />

            <EditDespesaModal
                isOpen={!!editTarget}
                conta={editTarget}
                onClose={() => setEditTarget(null)}
                onSave={async (id, patch) => {
                    await updateContaAPagar({ id, patch })
                    toast.success('Despesa atualizada!')
                    refetch()
                }}
            />

            {paymentTarget && (
                <PagamentoContaAPagarModal
                    isOpen={!!paymentTarget}
                    onClose={() => setPaymentTarget(null)}
                    conta={paymentTarget}
                    onConfirm={async (data) => {
                        await registrarPagamento(data)
                        setPaymentTarget(null)
                    }}
                />
            )}

            <ConfirmDialog
                open={!!deleteTarget}
                title="Excluir Despesa"
                message={deleteMessage}
                confirmLabel="Excluir"
                variant="danger"
                isLoading={isDeleting}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            <ConfirmDialog
                open={!!recorrenteDeleteTarget}
                title="Excluir Despesa Fixa"
                message="Remove o modelo recorrente: para de gerar nos próximos meses. As despesas já geradas continuam intactas."
                confirmLabel="Excluir"
                variant="danger"
                onConfirm={handleDeleteRecorrente}
                onCancel={() => setRecorrenteDeleteTarget(null)}
            />
        </>
    )
}
