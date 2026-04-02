
import { useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useCatalogOrders } from '../../../../hooks/useCatalogOrders'
import { formatDate, formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { DomainCatalogOrder } from '../../../../types/domain'

interface CatalogOrderCardProps {
    pedido: DomainCatalogOrder;
    onView?: (vendaId: string) => void;
}

function CatalogOrderCard({ pedido, onView }: CatalogOrderCardProps) {
    const isClickable = !!pedido.vendaId

    const statusColors: Record<string, string> = {
        pendente: "bg-blue-500/10 text-blue-500 border-blue-500/20",
        confirmado: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
        preparando: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        enviado: "bg-orange-500/10 text-orange-500 border-orange-500/20",
        entregue: "bg-semantic-green/10 text-semantic-green border-semantic-green/20",
        cancelado: "bg-red-500/10 text-red-500 border-red-500/20"
    }

    const payColors: Record<string, string> = {
        pago: "text-semantic-green",
        pendente: "text-semantic-yellow",
        parcial: "text-orange-400"
    }

    return (
        <div
            onClick={() => isClickable && onView?.(pedido.vendaId!)}
            className={cn(
                "group relative bg-white/5 border-l-[4px] border-l-orange-500 hover:border-l-orange-400 p-4 rounded-r-xl transition-all hover:bg-white/10 mb-3 shadow-sm border-y border-r border-white/5",
                isClickable && "cursor-pointer"
            )}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase mb-1">Catálogo #{pedido.numeroPedido}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase border w-fit", statusColors[pedido.status] || "bg-gray-500/10 text-gray-500 border-gray-500/20")}>
                        {pedido.status}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                        {formatCurrency(pedido.totalCentavos / 100)}
                    </span>
                    <span className={cn("text-[10px] font-bold uppercase", payColors[pedido.statusPagamento] || "text-gray-500")}>
                        Pagamento: {pedido.statusPagamento}
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="flex-1 pr-4">
                    <div className="space-y-1">
                        {pedido.itens?.map((item, idx: number) => (
                            <div key={idx} className="text-xs text-gray-400 flex items-center justify-between border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                <span className="line-clamp-1">
                                    <span className="text-gray-500 font-mono mr-2">{item.quantidade}x</span>
                                    {item.nomeProduto}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 pl-2">
                    <p className="text-sm font-bold text-gray-400 font-mono mb-1">{formatDate(pedido.criadoEm)}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">
                            {pedido.metodoEntrega === 'entrega' ? '🚚 Entrega' : '📦 Retirada'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function CatalogOrdersHistory({ contatoId }: { contatoId: string }) {
    const navigate = useNavigate()
    const { orders, isLoading, error } = useCatalogOrders(contatoId)

    if (isLoading) return <div className="text-center py-8 text-gray-400 text-sm">Carregando pedidos do catálogo...</div>
    if (error) return <div className="text-center py-8 text-red-400 text-sm">Erro ao carregar pedidos</div>
    if (orders.length === 0) return <div className="text-center py-8 text-gray-400 text-sm opacity-60 italic">Nenhum pedido via catálogo encontrado</div>

    return (
        <div className="mt-8">
            <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Package className="h-5 w-5 text-orange-500" />
                    Pedidos do Catálogo
                </h3>
            </div>
            <div className="mt-2">
                {orders.map((pedido) => (
                    <CatalogOrderCard
                        key={pedido.id}
                        pedido={pedido}
                        onView={(vendaId) => navigate(`/vendas/${vendaId}`)}
                    />
                ))}
            </div>
        </div>
    )
}
