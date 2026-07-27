import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { Modal } from '../../ui/Modal'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
// import { Select } from '../../ui/Select'
import { useProdutos } from '../../../hooks/useProdutos'
import { useContatos } from '../../../hooks/useContatos'
import { useToast } from '../../ui/Toast'
import type { CreatePurchaseOrder, UpdatePurchaseOrder, CreatePurchaseOrderItem, DomainPurchaseOrderWithItems } from '../../../types/domain'
import { formatCurrency } from '@mont/shared'

interface PurchaseOrderFormProps {
    isOpen: boolean
    onClose: () => void
    onSave: (order: CreatePurchaseOrder | UpdatePurchaseOrder, items: CreatePurchaseOrderItem[]) => Promise<void>
    initialData?: DomainPurchaseOrderWithItems | null
}

export function PurchaseOrderForm({ isOpen, onClose, onSave, initialData }: PurchaseOrderFormProps) {
    const { produtos } = useProdutos()
    const { contatos } = useContatos({ filtros: { tipo: 'FORNECEDOR', status: 'todos', origem: 'todos', busca: '' } })
    const toast = useToast()
    const [loading, setLoading] = useState(false)

    // Header State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [notes, setNotes] = useState('')
    const [fornecedorId, setFornecedorId] = useState('')
    const [amountPaid, setAmountPaid] = useState<number>(0)

    // Items State
    const [items, setItems] = useState<Array<{
        tempId: string
        product_id: string
        quantity: number
        unit_cost: number
    }>>([])

    // Initialize form on open
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setDate(initialData.orderDate.split('T')[0])
                setNotes(initialData.notes || '')
                setFornecedorId(initialData.fornecedorId || '')
                setAmountPaid(initialData.amountPaid || 0)
                setItems(initialData.items.map(item => ({
                    tempId: Math.random().toString(36),
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_cost: item.unitCost
                })))
            } else {
                // Reset for new order
                setDate(new Date().toISOString().split('T')[0])
                setNotes('')
                setFornecedorId('')
                setAmountPaid(0)
                setItems([])
            }
        }
    }, [isOpen, initialData])

    const handleAddItem = () => {
        setItems([...items, {
            tempId: Math.random().toString(36),
            product_id: '',
            quantity: 1,
            unit_cost: 0
        }])
    }

    const handleRemoveItem = (tempId: string) => {
        setItems(items.filter(i => i.tempId !== tempId))
    }

    const handleItemChange = (tempId: string, field: string, value: string | number) => {
        setItems(items.map(item => {
            if (item.tempId === tempId) {
                const updated = { ...item, [field]: value }

                // Auto-fill cost when product changes
                if (field === 'product_id') {
                    const product = produtos.find(p => p.id === value)
                    if (product) {
                        updated.unit_cost = product.custo
                    }
                }
                return updated
            }
            return item
        }))
    }

    const totalAmount = useMemo(() => {
        return items.reduce((acc, item) => acc + (item.quantity * item.unit_cost), 0)
    }, [items])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) {
            toast.error('Adicione pelo menos um item ao pedido.')
            return
        }
        if (items.some(i => !i.product_id || i.quantity <= 0)) {
            toast.error('Preencha todos os campos dos itens corretamente.')
            return
        }
        if (!fornecedorId) {
            toast.error('Selecione um fornecedor.')
            return
        }

        setLoading(true)
        try {
            // Determine payment status
            let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid'
            if (amountPaid >= totalAmount && totalAmount > 0) paymentStatus = 'paid'
            else if (amountPaid > 0) paymentStatus = 'partial'

            const mappedItems: CreatePurchaseOrderItem[] = items.map(i => ({
                productId: i.product_id,
                quantity: i.quantity,
                unitCost: i.unit_cost
            }))

            await onSave({
                orderDate: date,
                notes: notes,
                fornecedorId: fornecedorId,
                totalAmount: totalAmount,
                status: initialData ? initialData.status : 'pending',
                paymentStatus: paymentStatus,
                amountPaid: amountPaid
            } as CreatePurchaseOrder, mappedItems)
            onClose()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao salvar pedido.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? 'Editar Pedido de Compra' : 'Novo Pedido de Compra'}
            size="3xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Input
                        label="Data do Pedido"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                    />
                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Fornecedor</label>
                        <select
                            className="w-full bg-background border border-input rounded-lg py-2 px-3 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring transition-all cursor-pointer h-10"
                            value={fornecedorId}
                            onChange={(e) => setFornecedorId(e.target.value)}
                            required
                        >
                            <option value="">Selecione...</option>
                            {contatos.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.nome}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <Input
                            label="Observações"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Opcional"
                        />
                    </div>
                </div>

                {/* Items Repeater */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-border pb-2">
                        <h3 className="text-lg font-medium text-foreground">Itens do Pedido</h3>
                        <Button type="button" variant="secondary" size="sm" onClick={handleAddItem}>
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Item
                        </Button>
                    </div>

                    {items.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground bg-muted rounded-lg border border-dashed border-input flex flex-col items-center justify-center gap-2">
                            <div className="bg-background p-3 rounded-full mb-2">
                                <Plus className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p>Seu pedido está vazio</p>
                            <p className="text-sm text-muted-foreground">Adicione itens acima para começar</p>
                        </div>
                    )}

                    {/* MOBILE (<lg): cards por item — intocados (mobile sagrado) */}
                    <div className="space-y-3 lg:hidden">
                        {items.map((item) => (
                            <div key={item.tempId} className="grid grid-cols-12 gap-3 items-end bg-muted p-3 rounded-lg border border-border hover:border-border transition-colors">
                                <div className="col-span-12 sm:col-span-5">
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Produto</label>
                                    <select
                                        className="w-full bg-background border border-input rounded-lg py-2 px-3 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60 appearance-none cursor-pointer hover:bg-muted h-10"
                                        value={item.product_id}
                                        onChange={(e) => handleItemChange(item.tempId, 'product_id', e.target.value)}
                                        required
                                    >
                                        <option value="">Selecione...</option>
                                        {produtos.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.nome} ({p.unidade})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        label="Qtd"
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(item.tempId, 'quantity', Number(e.target.value))}
                                        className="h-10"
                                    />
                                </div>
                                <div className="col-span-4 sm:col-span-2">
                                    <Input
                                        label="Custo Unit."
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.unit_cost}
                                        onChange={(e) => handleItemChange(item.tempId, 'unit_cost', Number(e.target.value))}
                                        className="h-10"
                                    />
                                </div>
                                <div className="col-span-3 sm:col-span-2 flex flex-col justify-end h-full pb-1">
                                    <div className="text-xs text-muted-foreground mb-1">Total</div>
                                    <div className="text-foreground font-bold text-sm h-9 flex items-center">
                                        {formatCurrency(item.quantity * item.unit_cost)}
                                    </div>
                                </div>
                                <div className="col-span-1 sm:col-span-1 flex items-end justify-center pb-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(item.tempId)}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* DESKTOP (≥lg): tabela densa de itens */}
                    {items.length > 0 && (
                        <div className="hidden lg:block rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-muted-foreground bg-muted border-b border-border">
                                    <tr>
                                        <th className="px-3 py-2 font-medium text-left">Produto</th>
                                        <th className="px-3 py-2 font-medium text-center w-24">Qtd</th>
                                        <th className="px-3 py-2 font-medium text-right w-32">Custo Unit.</th>
                                        <th className="px-3 py-2 font-medium text-right w-32">Total</th>
                                        <th className="px-3 py-2 w-12"><span className="sr-only">Excluir</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.tempId} className="border-b border-border last:border-0">
                                            <td className="px-3 py-2">
                                                <select
                                                    className="w-full bg-background border border-input rounded-lg py-2 px-3 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-ring transition-all appearance-none cursor-pointer hover:bg-muted h-9"
                                                    value={item.product_id}
                                                    onChange={(e) => handleItemChange(item.tempId, 'product_id', e.target.value)}
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    {produtos.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.nome} ({p.unidade})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 align-middle">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.tempId, 'quantity', Number(e.target.value))}
                                                    className="h-9 text-center"
                                                    aria-label="Quantidade"
                                                />
                                            </td>
                                            <td className="px-3 py-2 align-middle">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={item.unit_cost}
                                                    onChange={(e) => handleItemChange(item.tempId, 'unit_cost', Number(e.target.value))}
                                                    className="h-9 text-right"
                                                    aria-label="Custo unitário"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                                                {formatCurrency(item.quantity * item.unit_cost)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveItem(item.tempId)}
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                    aria-label="Excluir item"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer / Totals */}
                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-end border-t border-border pt-6 gap-4">
                    <div className="w-full sm:w-auto flex-1 max-w-[250px]">
                        <div className="relative">
                            <Input
                                label="Valor Pago"
                                type="number"
                                step="0.01"
                                min="0"
                                value={amountPaid}
                                onChange={(e) => setAmountPaid(Number(e.target.value))}
                                className="pr-12 bg-muted/50 cursor-not-allowed text-muted-foreground"
                                disabled
                                title="O valor pago é calculado automaticamente com base nos pagamentos registrados."
                            />
                            {totalAmount > 0 && (
                                <div className="absolute right-0 top-0 text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-bl-lg">
                                    {((amountPaid / totalAmount) * 100).toFixed(0)}%
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                        <div className="flex flex-col items-end">
                            <span className="text-sm text-muted-foreground">Total do Pedido</span>
                            <span className="text-2xl font-bold text-foreground">
                                {formatCurrency(totalAmount)}
                            </span>
                        </div>

                        <div className="flex gap-3 w-full sm:w-auto justify-end">
                            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" disabled={loading} className="px-6">
                                {loading ? (
                                    'Salvando...'
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Pedido
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    )
}
