import { useState } from 'react'
import { ShoppingCart, Trash2, Minus, Plus, User, Search, ChevronRight } from 'lucide-react'
import { cn, formatCurrency, formatPhone } from '@mont/shared'
import { Modal } from '../../../../ui'
import { ClientSelector } from '../ClientSelector'
import type { CartItem } from '../../../../../stores/useCartStore'
import type { DomainContato } from '../../../../../types/domain'

interface PosCartProps {
    items: CartItem[]
    total: number
    selectedContato: DomainContato | null
    onSelectContato: (c: DomainContato | null) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
    onClear: () => void
    onCheckout: () => void
}

// Carrinho persistente do PDV (espelha o Cart da Adega, tema Mont): cliente no topo →
// itens (scroll) → rodapé fixo com Total + "Ir para pagamento".
export function PosCart({ items, total, selectedContato, onSelectContato, onUpdateQuantity, onClear, onCheckout }: PosCartProps) {
    const [clienteOpen, setClienteOpen] = useState(false)
    const totalItens = items.reduce((acc, i) => acc + i.quantidade, 0)
    const podeAvancar = items.length > 0 && !!selectedContato

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {/* Cliente + cabeçalho */}
            <div className="shrink-0 border-b border-border bg-muted/40 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</p>
                <button
                    type="button"
                    onClick={() => setClienteOpen(true)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted"
                >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                            {selectedContato ? selectedContato.nome : 'Consumidor não selecionado'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                            {selectedContato ? formatPhone(selectedContato.telefone) : 'Toque para escolher o cliente'}
                        </p>
                    </div>
                    <Search className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                </button>

                <div className="mt-4 flex items-end justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <ShoppingCart className="size-5 text-primary" /> Carrinho
                    </h2>
                    <div className="flex items-center gap-2">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                        </span>
                        {items.length > 0 && (
                            <button
                                onClick={onClear}
                                className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                                title="Limpar carrinho"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Itens */}
            {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                    <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                        <ShoppingCart className="size-7 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Seu carrinho está vazio</p>
                    <p className="text-xs">Adicione produtos para começar a venda</p>
                </div>
            ) : (
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                    {items.map((item) => (
                        <div key={item.produto_id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{item.produto.nome}</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(item.preco_unitario)} un.</p>
                            </div>
                            <div className="flex items-center gap-1 rounded-lg bg-background p-1">
                                <button
                                    aria-label="Diminuir"
                                    onClick={() => onUpdateQuantity(item.produto_id, -1)}
                                    className="flex size-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                                >
                                    <Minus className="size-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantidade}</span>
                                <button
                                    aria-label="Aumentar"
                                    onClick={() => onUpdateQuantity(item.produto_id, 1)}
                                    className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform active:scale-95"
                                >
                                    <Plus className="size-3.5" />
                                </button>
                            </div>
                            <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-foreground">
                                {formatCurrency(item.subtotal)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Rodapé: totais + pagamento */}
            <div className="shrink-0 border-t border-border bg-muted/40 p-4">
                <div className="mb-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tabular-nums">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex items-baseline justify-between border-t border-border pt-2">
                        <span className="text-base font-bold text-foreground">Total</span>
                        <span className="text-2xl font-black tabular-nums text-primary">{formatCurrency(total)}</span>
                    </div>
                </div>
                <button
                    onClick={onCheckout}
                    disabled={!podeAvancar}
                    className={cn(
                        'flex h-14 w-full items-center justify-between rounded-xl px-6 text-base font-bold transition-all active:scale-[0.99]',
                        podeAvancar
                            ? 'bg-primary text-primary-foreground shadow-elevated hover:opacity-90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground',
                    )}
                >
                    <span>{!selectedContato ? 'Escolha um cliente' : items.length === 0 ? 'Carrinho vazio' : 'Ir para pagamento'}</span>
                    {podeAvancar && (
                        <span className="flex items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-sm">
                            {formatCurrency(total)} <ChevronRight className="size-4" />
                        </span>
                    )}
                </button>
            </div>

            {/* Modal de seleção de cliente (reusa o ClientSelector) */}
            <Modal isOpen={clienteOpen} onClose={() => setClienteOpen(false)} title="Cliente" size="md">
                <ClientSelector
                    selectedContato={selectedContato}
                    onSelect={(c) => {
                        onSelectContato(c)
                        if (c) setClienteOpen(false)
                    }}
                />
            </Modal>
        </div>
    )
}
