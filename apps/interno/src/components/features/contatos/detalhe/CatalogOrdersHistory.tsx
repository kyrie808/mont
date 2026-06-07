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
        pendente: "bg-muted text-muted-foreground border-border",
        confirmado: "bg-primary/10 text-primary border-primary/20",
        preparando: "bg-warning/10 text-warning-strong border-warning/20",
        enviado: "bg-warning-strong/10 text-warning-strong border-warning-strong/20",
        entregue: "bg-semantic-green/10 text-semantic-green border-semantic-green/20",
        cancelado: "bg-destructive/10 text-destructive border-destructive/20"
    }

    const payColors: Record<string, string> = {
        pago: "text-semantic-green",
        pendente: "text-semantic-yellow",
        parcial: "text-warning-strong"
    }

    return (
        <div
            onClick={() => isClickable && onView?.(pedido.vendaId!)}
            className={cn(
                "group relative bg-foreground/5 border-l-[4px] border-l-warning-strong hover:border-l-warning-strong/70 p-4 rounded-r-xl transition-all hover:bg-foreground/10 mb-3 shadow-card border-y border-r border-border",
                isClickable && "cursor-pointer"
            )}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase mb-1">Catálogo #{pedido.numeroPedido}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase border w-fit", statusColors[pedido.status] || "bg-muted text-muted-foreground border-border")}>
                        {pedido.status}
                    </span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                        {formatCurrency(pedido.total)}
                    </span>
                    <span className={cn("text-[10px] font-bold uppercase", payColors[pedido.statusPagamento] || "text-muted-foreground")}>
                        Pagamento: {pedido.statusPagamento}
                    </span>
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="flex-1 pr-4">
                    <div className="space-y-1">
                        {pedido.itens?.map((item, idx: number) => (
                            <div key={idx} className="text-xs text-muted-foreground flex items-center justify-between border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                <span className="line-clamp-1">
                                    <span className="text-muted-foreground font-mono mr-2">{item.quantidade}x</span>
                                    {item.nomeProduto}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 pl-2">
                    <p className="text-sm font-bold text-muted-foreground font-mono mb-1">{formatDate(pedido.criadoEm)}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
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

    if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Carregando pedidos do catálogo...</div>
    if (error) return <div className="text-center py-8 text-destructive text-sm">Erro ao carregar pedidos</div>
    if (orders.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm opacity-60 italic">Nenhum pedido via catálogo encontrado</div>

    return (
        <div className="mt-8">
            <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Package className="h-5 w-5 text-warning-strong" />
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
