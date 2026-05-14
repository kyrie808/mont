import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Search,
    Filter,
    Calendar,
    Phone,
    CheckCircle2,
    AlertCircle,
    Clock,
    CalendarDays
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { vendaService } from '../services/vendaService'
import type { DomainVenda } from '../types/domain'
import { formatCurrency, formatDate } from '@mont/shared'
import { differenceInDays, parseISO, isPast, isToday as isTodayFns, addDays, isBefore } from 'date-fns'
import { cn } from '@mont/shared'
import { useToast } from '../components/ui/Toast'
import { cashFlowService } from '../services/cashFlowService'
import { Modal, ModalActions, Select, Badge } from '../components/ui'
import type { Conta } from '@mont/shared'

type StatusFilter = 'todos' | 'vencidos' | 'hoje' | 'semana'

export function ContasReceber() {
    const [vendas, setVendas] = useState<DomainVenda[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<StatusFilter>('todos')
    const [searchTerm, setSearchTerm] = useState('')
    const [contas, setContas] = useState<Conta[]>([])
    const [selectedVenda, setSelectedVenda] = useState<DomainVenda | null>(null)
    const [selectedContaId, setSelectedContaId] = useState('')
    const [isQuitting, setIsQuitting] = useState(false)
    const navigate = useNavigate()
    const toast = useToast()

    const fetchVendas = useCallback(async () => {
        try {
            setIsLoading(true)
            // Fetch all delivered but unpaid sales
            const data = await vendaService.getVendas(undefined, undefined, false)
            setVendas(data.filter(v => v.status === 'entregue' && !v.pago && v.origem !== 'catalogo' && v.formaPagamento !== 'brinde'))
        } catch (_error) {
            toast.error('Não foi possível carregar as contas a receber')
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchContas = useCallback(async () => {
        try {
            const data = await cashFlowService.getContas()
            setContas(data)
            if (data.length > 0) setSelectedContaId(data[0].id)
        } catch (_error) {
        }
    }, [])

    useEffect(() => {
        fetchVendas()
        fetchContas()
    }, [fetchVendas, fetchContas])

    const filteredVendas = useMemo(() => {
        let result = vendas

        if (searchTerm) {
            result = result.filter(v =>
                v.contato?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                v.total.toString().includes(searchTerm)
            )
        }

        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        if (filter === 'vencidos') {
            result = result.filter(v =>
                v.dataPrevistaPagamento &&
                isBefore(parseISO(v.dataPrevistaPagamento), hoje)
            )
        } else if (filter === 'hoje') {
            result = result.filter(v =>
                v.dataPrevistaPagamento &&
                isTodayFns(parseISO(v.dataPrevistaPagamento))
            )
        } else if (filter === 'semana') {
            const umaSemana = addDays(hoje, 7)
            result = result.filter(v =>
                v.dataPrevistaPagamento &&
                isPast(parseISO(v.dataPrevistaPagamento)) === false &&
                isBefore(parseISO(v.dataPrevistaPagamento), umaSemana)
            )
        }

        // Sort: Vencidos first, then by date, nulls last
        return [...result].sort((a, b) => {
            if (!a.dataPrevistaPagamento) return 1
            if (!b.dataPrevistaPagamento) return -1
            return a.dataPrevistaPagamento.localeCompare(b.dataPrevistaPagamento)
        })
    }, [vendas, filter, searchTerm])

    const handleQuitar = (venda: DomainVenda) => {
        setSelectedVenda(venda)
    }

    const confirmQuitar = async () => {
        if (!selectedVenda || !selectedContaId) return

        try {
            setIsQuitting(true)
            await vendaService.quitarVenda(selectedVenda.id, selectedVenda.formaPagamento, selectedContaId)
            toast.success('Venda quitada com sucesso')
            setSelectedVenda(null)
            fetchVendas()
        } catch (_error) {
            toast.error('Não foi possível quitar a venda')
        } finally {
            setIsQuitting(false)
        }
    }

    return (
        <>
            <Header title="Contas a Receber" showBack centerTitle />

            <main className="max-w-5xl mx-auto p-4 pb-24 space-y-6">
                {/* Search & Filters */}
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar cliente ou valor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {[
                            { id: 'todos', label: 'Todos', icon: Filter },
                            { id: 'vencidos', label: 'Vencidos', icon: AlertCircle },
                            { id: 'hoje', label: 'Vencem Hoje', icon: Clock },
                            { id: 'semana', label: 'Essa Semana', icon: CalendarDays },
                        ].map((btn) => {
                            const Icon = btn.icon
                            const isSelected = filter === btn.id
                            return (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilter(btn.id as StatusFilter)}
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
                <div className="space-y-4">
                    {isLoading ? (
                        <div role="status" aria-live="polite" className="py-20 flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                            <p className="text-sm font-bold text-gray-500 uppercase">Carregando pendências...</p>
                        </div>
                    ) : filteredVendas.length === 0 ? (
                        <div className="py-20 flex flex-col items-center text-center space-y-4 bg-card/50 rounded-xl border border-dashed border-border">
                            <div className="p-4 bg-muted rounded-full">
                                <CheckCircle2 className="w-12 h-12 text-gray-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white">Nenhuma conta encontrada</h3>
                                <p className="text-sm text-gray-500">Tudo em dia por aqui!</p>
                            </div>
                        </div>
                    ) : (
                        filteredVendas.map((venda) => {
                            const dataPrevista = venda.dataPrevistaPagamento ? parseISO(venda.dataPrevistaPagamento) : null
                            const hoje = new Date()
                            hoje.setHours(0, 0, 0, 0)

                            let badgeVariant: 'danger' | 'warning' | 'success' | 'default' = 'default'
                            let label = "Sem Data"
                            let atraso = 0

                            if (dataPrevista) {
                                if (isBefore(dataPrevista, hoje)) {
                                    badgeVariant = 'danger'
                                    label = "Vencido"
                                    atraso = differenceInDays(hoje, dataPrevista)
                                } else if (isTodayFns(dataPrevista)) {
                                    badgeVariant = 'warning'
                                    label = "Vence Hoje"
                                } else {
                                    badgeVariant = 'success'
                                    label = "Futuro"
                                }
                            }

                            return (
                                <div
                                    key={venda.id}
                                    className="bg-card rounded-xl border border-border overflow-hidden shadow-card hover:shadow-elevated transition-shadow"
                                >
                                    <div className="p-5 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center font-bold text-lg text-gray-400">
                                                    {venda.contato?.nome?.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3
                                                        className="font-bold text-gray-900 dark:text-white leading-tight cursor-pointer hover:text-primary-500 transition-colors"
                                                        onClick={() => navigate(`/contatos/${venda.contatoId}`)}
                                                    >
                                                        {venda.contato?.nome || 'Cliente não identificado'}
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <div className="flex items-center gap-1 text-xs text-gray-500 font-bold uppercase tracking-tight">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(venda.data)}
                                                        </div>
                                                        {venda.contato?.telefone && (
                                                            <a
                                                                href={`https://wa.me/55${venda.contato.telefone.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-xs text-success font-bold uppercase tracking-tight hover:underline"
                                                            >
                                                                <Phone className="w-3 h-3" />
                                                                WhatsApp
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge variant={badgeVariant} className="uppercase">
                                                {label}{atraso > 0 ? ` (${atraso}d)` : ''}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-4 border-y border-border">
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Valor Pendente</span>
                                                <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(venda.total)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Previsão</span>
                                                <span className={cn(
                                                    "text-base font-bold",
                                                    atraso > 0 ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400"
                                                )}>
                                                    {venda.dataPrevistaPagamento
                                                        ? formatDate(venda.dataPrevistaPagamento)
                                                        : 'Não definida'
                                                    }
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 rounded-2xl h-12"
                                                onClick={() => navigate(`/vendas/${venda.id}`)}
                                            >
                                                Detalhes
                                            </Button>
                                            <Button
                                                variant="success"
                                                className="flex-[1.5] rounded-2xl h-12"
                                                onClick={() => handleQuitar(venda)}
                                            >
                                                Quitar Agora
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Modal de Quitação */}
                <Modal
                    isOpen={!!selectedVenda}
                    onClose={() => !isQuitting && setSelectedVenda(null)}
                    title="Confirmar Recebimento"
                    size="sm"
                >
                    {selectedVenda && (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-2xl border border-border">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Cliente</span>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{selectedVenda.contato?.nome}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Valor</span>
                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(selectedVenda.total)}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">
                                    Conta de Destino
                                </label>
                                <Select
                                    value={selectedContaId}
                                    onChange={(e) => setSelectedContaId(e.target.value)}
                                    className="w-full"
                                    options={contas.map(ct => ({ value: ct.id, label: ct.nome }))}
                                />
                            </div>

                            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                                <p className="text-xs text-primary font-medium">
                                    Este recebimento será registrado automaticamente no Fluxo de Caixa como entrada na conta selecionada.
                                </p>
                            </div>

                            <ModalActions>
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedVenda(null)}
                                    disabled={isQuitting}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    variant="success"
                                    onClick={confirmQuitar}
                                    isLoading={isQuitting}
                                    className="flex-[2]"
                                >
                                    Confirmar Recebimento
                                </Button>
                            </ModalActions>
                        </div>
                    )}
                </Modal>
            </main>
        </>
    )
}
