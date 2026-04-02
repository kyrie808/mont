
'use client'

import { ChevronDown, ChevronUp, Package, Phone, User, Monitor, Store, Trash2 } from 'lucide-react'
import StatusBadge from './StatusBadge'

interface OrderItem {
    id: string
    quantidade: number
    preco_unitario: number
    total_centavos: number
    produto: {
        nome: string
    }
}

interface Order {
    id: string
    numero_pedido: number
    nome_cliente: string
    telefone_cliente: string
    total_centavos: number
    status: string
    status_pagamento: string
    criado_em: string
    metodo_entrega: string
    metodo_pagamento: string
    origem?: string // 'online' or 'balcao' (inferred)
}

interface OrderCardProps {
    order: Order
    items?: OrderItem[]
    expanded: boolean
    onToggleExpand: () => void
    onStatusChange: (id: string, newStatus: string) => Promise<void>
    onPaymentStatusChange: (id: string, newStatus: string) => Promise<void>
    onDelete: (id: string, numero: number) => void
}

export default function OrderCard({
    order,
    items,
    expanded,
    onToggleExpand,
    onStatusChange,
    onPaymentStatusChange,
    onDelete
}: OrderCardProps) {

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(val / 100)
    }

    return (
        <div className={`bg-white rounded-lg border transition-all ${expanded ? 'shadow-md border-mont-gold/50' : 'shadow-sm border-gray-200'}`}>

            {/* Header Summary */}
            <div
                onClick={onToggleExpand}
                className="p-4 cursor-pointer"
            >
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-mont-espresso">
                            #{order.numero_pedido}
                        </span>
                        <StatusBadge status={order.status} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                        {formatDate(order.criado_em)}
                    </span>
                </div>

                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <User size={14} className="text-gray-400" />
                            {order.nome_cliente}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            {order.metodo_entrega === 'entrega' ? <Package size={12} /> : <Store size={12} />}
                            <span className="capitalize">{order.metodo_entrega}</span>
                            <span className="text-gray-300">|</span>
                            <span>{order.metodo_pagamento}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-mont-gold">
                            {formatCurrency(order.total_centavos)}
                        </span>
                        {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4">

                    {/* Actions */}
                    <div className="mb-4 flex flex-wrap gap-2">
                        <a
                            href={`tel:${order.telefone_cliente}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200"
                        >
                            <Phone size={14} />
                            Ligar
                        </a>

                        {/* Status Actions */}
                        {order.status !== 'cancelado' && (
                            <button
                                onClick={() => onStatusChange(order.id, order.status === 'entregue' ? 'pendente' : 'entregue')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${order.status === 'entregue'
                                    ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                                    : "bg-mont-espresso text-white hover:bg-black"
                                    }`}
                            >
                                {order.status === 'entregue' ? 'Desmarcar Entregue' : 'Marcar como Entregue'}
                            </button>
                        )}

                        {/* Payment Actions */}
                        <button
                            onClick={() => onPaymentStatusChange(order.id, order.status_pagamento === 'pago' ? 'pendente' : 'pago')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${order.status_pagamento === 'pago'
                                ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                                : "bg-mont-gold text-white hover:bg-mont-espresso"
                                }`}
                        >
                            {order.status_pagamento === 'pago' ? 'Desmarcar Pago' : 'Marcar como Pago'}
                        </button>

                        {/* Delete Action - Only for pendente/cancelado */}
                        {(order.status === 'pendente' || order.status === 'cancelado') && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(order.id, order.numero_pedido);
                                }}
                                className="ml-auto p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                title="Excluir Pedido"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itens do Pedido</h4>
                        {items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-mont-espresso bg-white w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-xs">
                                        {item.quantidade}x
                                    </span>
                                    <span className="text-gray-700 line-clamp-1">
                                        {item.produto?.nome || 'Produto Indefinido'}
                                    </span>
                                </div>
                                <div className="font-mono text-gray-600 text-xs">
                                    {formatCurrency(item.total_centavos)}
                                </div>
                            </div>
                        )) || <p className="text-xs text-gray-400 italic">Carregando itens...</p>}
                    </div>

                </div>
            )}
        </div>
    )
}
