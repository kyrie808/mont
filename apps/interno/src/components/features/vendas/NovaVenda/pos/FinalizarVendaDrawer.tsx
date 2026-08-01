import { useState, useEffect } from 'react'
import {
    Wallet, X, ShoppingCart, Calendar, Gift, Truck, Store, Tag,
    Clock, QrCode, Banknote, CreditCard, DollarSign, User, ChevronRight,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { addDays, format } from 'date-fns'
import { cn, formatCurrency, formatPhone } from '@mont/shared'
import { vendaSchema, type VendaFormData } from '../../../../../schemas/venda'
import { useEntregadores } from '../../../../../hooks/useEntregadores'
import { useContas } from '../../../../../hooks/useContas'
import type { CartItem } from '../../../../../stores/useCartStore'
import { Button } from '../../../../ui/Button'

// Pagamento imediato (quita na hora). Ausente = venda em aberto (quita depois no perfil).
export interface PagamentoImediato {
    metodo: 'pix' | 'dinheiro' | 'cartao'
    contaId: string
}

interface FinalizarVendaDrawerProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (data: VendaFormData, pagamento?: PagamentoImediato) => Promise<void>
    cart: CartItem[]
    total: number // subtotal dos produtos (cartTotal)
    contatoId: string
    contatoNome: string
    contatoTelefone?: string | null
}

// Intenção da venda (o enum real do Mont). A forma real de recebimento é resolvida no bloco Pagamento.
const SALE_TYPES = [
    { id: 'venda', label: 'Venda', icon: ShoppingCart },
    { id: 'fiado', label: 'Fiado', icon: Calendar },
    { id: 'brinde', label: 'Brinde', icon: Gift },
] as const

// Opções de recebimento (só quando a intenção é "venda"):
// "depois" = deixa em aberto (comporta como hoje); pix/dinheiro/cartao = quita na hora.
const RECEBIMENTOS = [
    { id: 'depois', label: 'Receber depois', icon: Clock },
    { id: 'pix', label: 'PIX', icon: QrCode },
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
    { id: 'cartao', label: 'Cartão', icon: CreditCard },
] as const

type Recebimento = (typeof RECEBIMENTOS)[number]['id']

export function FinalizarVendaDrawer({
    isOpen,
    onClose,
    onConfirm,
    cart,
    total,
    contatoId,
    contatoNome,
    contatoTelefone,
}: FinalizarVendaDrawerProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [tipoEntrega, setTipoEntrega] = useState<'retirada' | 'entrega'>('retirada')
    // Recebimento na hora (só p/ intenção "venda").
    const [recebimento, setRecebimento] = useState<Recebimento>('depois')
    const [contaId, setContaId] = useState('')
    const [valorRecebido, setValorRecebido] = useState(0)

    const { entregadores } = useEntregadores()
    const { contas } = useContas()
    const contasAtivas = contas.filter((c) => c.ativo !== false)

    const items: VendaFormData['itens'] = cart.map((i) => ({
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        subtotal: i.subtotal,
    }))

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm<VendaFormData>({
        resolver: zodResolver(vendaSchema) as any,
        defaultValues: {
            contato_id: contatoId,
            data: format(new Date(), 'yyyy-MM-dd'),
            forma_pagamento: 'venda',
            taxa_entrega: 0,
            desconto: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null,
            entregador_id: null,
            observacao_entregador: '',
            dinheiro_na_entrega: false,
        },
    })

    const formaPagamento = watch('forma_pagamento')
    const entregadorId = watch('entregador_id')
    const dinheiroNaEntrega = watch('dinheiro_na_entrega')
    const taxaEntregaValue = watch('taxa_entrega') || 0
    const descontoValue = watch('desconto') || 0
    // Produto com piso 0 (espelha o clamp da RPC) + frete.
    const totalGeral = Math.max(total - descontoValue, 0) + taxaEntregaValue

    const isPayNow = formaPagamento === 'venda' && recebimento !== 'depois'
    const troco = recebimento === 'dinheiro' && valorRecebido > totalGeral ? valorRecebido - totalGeral : 0

    // Reset ao (re)abrir ou trocar o cliente/itens.
    useEffect(() => {
        if (!isOpen) return
        setTipoEntrega('retirada')
        setRecebimento('depois')
        setContaId('')
        setValorRecebido(0)
        reset({
            contato_id: contatoId,
            data: format(new Date(), 'yyyy-MM-dd'),
            forma_pagamento: 'venda',
            taxa_entrega: 0,
            desconto: 0,
            parcelas: 1,
            itens: items,
            observacoes: '',
            data_prevista_pagamento: null,
            entregador_id: null,
            observacao_entregador: '',
            dinheiro_na_entrega: false,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, contatoId])

    // Sair de "venda" (p/ fiado/brinde) zera o recebimento na hora.
    useEffect(() => {
        if (formaPagamento !== 'venda') {
            setRecebimento('depois')
            setContaId('')
            setValorRecebido(0)
        }
    }, [formaPagamento])

    // Fiado calcula vencimento automático (30 dias).
    useEffect(() => {
        if (formaPagamento === 'fiado') {
            setValue('data_prevista_pagamento', addDays(new Date(), 30).toISOString())
        } else {
            setValue('data_prevista_pagamento', null)
        }
    }, [formaPagamento, setValue])

    const handleTipoEntrega = (tipo: 'retirada' | 'entrega') => {
        setTipoEntrega(tipo)
        if (tipo === 'retirada') {
            setValue('taxa_entrega', 0)
            setValue('entregador_id', null)
            setValue('observacao_entregador', '')
            setValue('dinheiro_na_entrega', false)
        }
    }

    const onSubmit = async (data: VendaFormData) => {
        const pagamento: PagamentoImediato | undefined = isPayNow
            ? { metodo: recebimento as PagamentoImediato['metodo'], contaId }
            : undefined
        try {
            setIsSubmitting(true)
            await onConfirm(data, pagamento)
        } catch (error) {
            console.error('Erro ao finalizar venda:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const canConfirm = !isSubmitting && !(isPayNow && !contaId)

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden
            />

            {/* Painel */}
            <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-elevated animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/50 p-5">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                        <Wallet className="size-6 text-primary" /> Finalizar Venda
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Fechar"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Esquerda: Resumo do Pedido */}
                    <div className="hidden w-1/3 shrink-0 flex-col border-r border-border bg-muted/20 p-4 md:flex">
                        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo do Pedido</h3>
                        <div className="flex-1 space-y-3 overflow-y-auto">
                            {cart.map((item) => (
                                <div key={item.produto_id} className="flex items-start justify-between gap-2 text-sm">
                                    <div className="min-w-0">
                                        <p className="line-clamp-2 text-foreground">{item.produto.nome}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.quantidade}x {formatCurrency(item.preco_unitario)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 font-medium tabular-nums text-foreground">{formatCurrency(item.subtotal)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 space-y-2 border-t border-border pt-4">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Subtotal</span>
                                <span className="tabular-nums">{formatCurrency(total)}</span>
                            </div>
                            {descontoValue > 0 && (
                                <div className="flex justify-between text-sm text-success">
                                    <span>Desconto</span>
                                    <span className="tabular-nums">- {formatCurrency(descontoValue)}</span>
                                </div>
                            )}
                            {taxaEntregaValue > 0 && (
                                <div className="flex justify-between text-sm text-primary">
                                    <span>Frete</span>
                                    <span className="tabular-nums">+ {formatCurrency(taxaEntregaValue)}</span>
                                </div>
                            )}
                            <div className="flex items-baseline justify-between border-t border-border pt-2">
                                <span className="text-base font-bold text-foreground">Total</span>
                                <span className="text-xl font-black tabular-nums text-primary">{formatCurrency(totalGeral)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Direita: formulários */}
                    <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-7 overflow-y-auto p-6">
                        {/* Cliente */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cliente</label>
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <User className="size-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-foreground">{contatoNome}</p>
                                    {contatoTelefone && (
                                        <p className="truncate text-xs text-muted-foreground">{formatPhone(contatoTelefone)}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Tipo de Venda (intenção) */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Venda</label>
                            <div className="grid grid-cols-3 gap-2">
                                {SALE_TYPES.map((type) => {
                                    const Icon = type.icon
                                    const isSelected = formaPagamento === type.id
                                    return (
                                        <button
                                            key={type.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setValue('forma_pagamento', type.id as VendaFormData['forma_pagamento'])}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20'
                                                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                                            )}
                                        >
                                            <Icon className="size-5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{type.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Pagamento (só p/ Venda): receber depois OU quitar na hora */}
                        {formaPagamento === 'venda' && (
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pagamento</label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {RECEBIMENTOS.map((opt) => {
                                        const Icon = opt.icon
                                        const isSelected = recebimento === opt.id
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setRecebimento(opt.id)}
                                                className={cn(
                                                    'flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                                    isSelected
                                                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20'
                                                        : 'border-border bg-background text-muted-foreground hover:bg-muted',
                                                )}
                                            >
                                                <Icon className="size-5" />
                                                <span className="text-center text-[10px] font-bold uppercase leading-tight tracking-wider">{opt.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {isPayNow && (
                                    <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Conta de destino</label>
                                            <select
                                                value={contaId}
                                                onChange={(e) => setContaId(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                <option value="">Selecione a conta…</option>
                                                {contasAtivas.map((ct) => (
                                                    <option key={ct.id} value={ct.id}>{ct.nome}</option>
                                                ))}
                                            </select>
                                            {!contaId && (
                                                <p className="mt-1 text-[11px] font-medium text-warning-strong">Escolha a conta que recebeu o dinheiro.</p>
                                            )}
                                        </div>

                                        {recebimento === 'dinheiro' && (
                                            <div>
                                                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor recebido</label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-success" />
                                                    <input
                                                        type="number"
                                                        step="0.50"
                                                        min="0"
                                                        value={valorRecebido || ''}
                                                        onChange={(e) => setValorRecebido(Number(e.target.value))}
                                                        className="w-full rounded-lg border border-success/30 bg-background pl-9 pr-3 py-2 text-sm font-bold tabular-nums text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                                {troco > 0 && (
                                                    <div className="mt-2 flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-3 py-2">
                                                        <span className="text-sm font-medium text-success">Troco</span>
                                                        <span className="text-base font-bold tabular-nums text-success">{formatCurrency(troco)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fiado: vencimento */}
                        {formaPagamento === 'fiado' && (
                            <div className="space-y-2 rounded-xl border border-warning-strong/30 bg-warning-strong/10 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="block text-sm font-medium text-warning-strong">Data de Vencimento</label>
                                <input
                                    type="date"
                                    {...register('data_prevista_pagamento')}
                                    className={cn(
                                        'w-full rounded-lg border bg-background px-3 py-2 text-foreground outline-hidden focus-visible:ring-2',
                                        errors.data_prevista_pagamento
                                            ? 'border-destructive focus-visible:ring-destructive'
                                            : 'border-warning-strong/30 focus-visible:ring-warning-strong',
                                    )}
                                />
                                {errors.data_prevista_pagamento && (
                                    <span className="text-[10px] font-bold text-destructive">{errors.data_prevista_pagamento.message}</span>
                                )}
                            </div>
                        )}

                        {/* Brinde: sem pagamento */}
                        {formaPagamento === 'brinde' && (
                            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-muted-foreground animate-in fade-in slide-in-from-top-2 duration-200">
                                <Gift className="size-5 shrink-0 text-primary" />
                                <p className="text-sm">Brinde não recebe pagamento — sai como cortesia (não entra no faturamento).</p>
                            </div>
                        )}

                        {/* Desconto (R$) */}
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Tag className="size-5" />
                                <span className="text-sm font-medium">Desconto</span>
                            </div>
                            <div className="relative w-28">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                <input
                                    type="number"
                                    step="0.50"
                                    min="0"
                                    max={total}
                                    {...register('desconto', { valueAsNumber: true })}
                                    className={cn(
                                        'w-full rounded-lg border bg-background py-2 pl-9 pr-2 text-right text-sm font-bold tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                        descontoValue > 0 ? 'border-success/40 text-success' : 'border-border text-foreground',
                                    )}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Entrega: Retirada x Entrega */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entrega</label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'retirada', label: 'Retirada', icon: Store },
                                    { id: 'entrega', label: 'Entrega', icon: Truck },
                                ] as const).map((opt) => {
                                    const Icon = opt.icon
                                    const isSelected = tipoEntrega === opt.id
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => handleTipoEntrega(opt.id)}
                                            className={cn(
                                                'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                                isSelected
                                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20'
                                                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                                            )}
                                        >
                                            <Icon className="size-5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{opt.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {tipoEntrega === 'entrega' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Truck className="size-5" />
                                            <span className="text-sm font-medium">Frete</span>
                                        </div>
                                        <div className="relative w-28">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                            <input
                                                type="number"
                                                step="0.50"
                                                min="0"
                                                {...register('taxa_entrega', { valueAsNumber: true })}
                                                className={cn(
                                                    'w-full rounded-lg border bg-background py-2 pl-9 pr-2 text-right text-sm font-bold tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                                                    taxaEntregaValue > 0 ? 'border-primary/40 text-primary' : 'border-border text-foreground',
                                                )}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Entregador</label>
                                        <select
                                            value={entregadorId ?? ''}
                                            onChange={(e) => setValue('entregador_id', e.target.value || null)}
                                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <option value="">Selecione o entregador…</option>
                                            {entregadores.map((ent) => (
                                                <option key={ent.id} value={ent.id}>{ent.nome}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observação para o entregador</label>
                                        <textarea
                                            {...register('observacao_entregador')}
                                            rows={2}
                                            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/60"
                                            placeholder="Ex: Aguardar confirmação de pagamento para entregar."
                                        />
                                    </div>
                                    <label className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={!!dinheiroNaEntrega}
                                            onChange={(e) => setValue('dinheiro_na_entrega', e.target.checked)}
                                            className="size-4 rounded border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                        <span className="text-sm text-foreground">Pagamento em dinheiro na entrega</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Observações */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observações</label>
                            <textarea
                                {...register('observacoes')}
                                rows={2}
                                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/60"
                                placeholder="Ex: Deixar na portaria…"
                            />
                        </div>
                    </form>
                </div>

                {/* Rodapé fixo */}
                <div className="shrink-0 border-t border-border bg-card p-4">
                    <Button
                        onClick={handleSubmit(onSubmit)}
                        disabled={!canConfirm}
                        className="flex h-14 w-full items-center justify-between px-6 text-lg font-black uppercase tracking-tight shadow-elevated shadow-primary/20"
                    >
                        {isSubmitting ? (
                            <span className="mx-auto">Processando…</span>
                        ) : (
                            <>
                                <span>Confirmar Venda</span>
                                <span className="flex items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-base">
                                    {formatCurrency(totalGeral)} <ChevronRight className="size-4" />
                                </span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
