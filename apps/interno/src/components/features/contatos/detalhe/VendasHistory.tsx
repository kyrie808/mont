import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit, Trash2, ShoppingCart } from 'lucide-react'
import { Button, Modal, ModalActions } from '../../../../components/ui'
import { useVendas } from '../../../../hooks/useVendas'
import { formatDate, formatCurrency } from '@mont/shared'
import type { DomainVenda } from '../../../../types/domain'

interface ReceiptCardProps {
    venda: DomainVenda;
    onEdit?: (id: string, e: React.MouseEvent) => void;
    onView?: (id: string, e: React.MouseEvent) => void;
    onDelete?: (id: string, e: React.MouseEvent) => void;
}

function ReceiptCard({ venda, onEdit, onView, onDelete }: ReceiptCardProps) {
    return (
        <div
            onClick={(e) => onView && onView(venda.id, e)}
            className="group relative bg-white/5 border-l-[4px] border-l-primary hover:border-l-primary-400 p-4 rounded-r-xl transition-all hover:bg-white/10 mb-3 shadow-sm border-y border-r border-white/5 cursor-pointer"
        >
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] text-gray-500 font-mono tracking-widest">#{venda.id.slice(0, 8).toUpperCase()}</span>
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground tabular-nums">
                        {formatCurrency(venda.total)}
                    </span>
                    {venda.pago ? (
                        <span className="bg-semantic-green/10 text-semantic-green text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-semantic-green/20">Pago</span>
                    ) : (
                        <span className="bg-semantic-yellow/10 text-semantic-yellow text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-semantic-yellow/20">A Receber</span>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-end">
                <div className="flex-1 pr-4">
                    <div className="space-y-1">
                        {venda.itens.map((item, idx: number) => (
                            <div key={idx} className="text-xs text-gray-400 flex items-center justify-between border-b border-white/5 pb-1 last:border-0 last:pb-0">
                                <span className="line-clamp-1">
                                    <span className="text-gray-500 font-mono mr-2">{item.quantidade}x</span>
                                    {item.produto?.nome || 'Produto'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 pl-2">
                    <p className="text-sm font-bold text-gray-400 font-mono mb-1">{formatDate(venda.data)}</p>
                    <div className="flex items-center gap-1">
                        {venda.status !== 'cancelada' && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg"
                                onClick={(e) => onEdit && onEdit(venda.id, e)}
                                title="Editar"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                        {venda.status === 'cancelada' && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                onClick={(e) => onDelete && onDelete(venda.id, e)}
                                title="Excluir"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function VendasHistory({ contatoId }: { contatoId: string }) {
    const navigate = useNavigate()
    const { vendas: todasVendas, loading, error, deleteVenda } = useVendas({ excludeCatalogo: true })

    // Filter locally
    const vendas = todasVendas.filter(v => v.contatoId === contatoId)
    const [vendaToDelete, setVendaToDelete] = useState<string | null>(null)

    const handleDelete = async () => {
        if (!vendaToDelete) return
        await deleteVenda(vendaToDelete)
        setVendaToDelete(null)
    }

    if (loading) return <div className="text-center py-8 text-gray-400 text-sm">Carregando histórico...</div>
    if (error) return <div className="text-center py-8 text-red-400 text-sm">Erro ao carregar histórico</div>
    if (vendas.length === 0) return <div className="text-center py-8 text-gray-400 text-sm opacity-60">Nenhuma compra registrada 🍃</div>

    return (
        <div className="mt-8">
            <div className="flex justify-between items-end mb-4 px-2">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary-500" />
                    Histórico de Compras (Interno)
                </h3>
                <span className="text-xs text-primary-400 font-bold uppercase tracking-wider">
                    Total: {formatCurrency(vendas.reduce((acc, v) => v.status !== 'cancelada' ? acc + v.total : acc, 0))}
                </span>
            </div>

            <div className="mt-2">
                {vendas.map((venda) => (
                    <div key={venda.id}>
                        <ReceiptCard
                            venda={venda}
                            onView={(id, e) => {
                                e.stopPropagation();
                                navigate(`/vendas/${id}`);
                            }}
                            onEdit={(id, e) => {
                                e.stopPropagation();
                                navigate(`/vendas/${id}/editar`);
                            }}
                            onDelete={(id, e) => {
                                e.stopPropagation();
                                setVendaToDelete(id);
                            }}
                        />
                    </div>
                ))}

                <Modal
                    isOpen={!!vendaToDelete}
                    onClose={() => setVendaToDelete(null)}
                    title="Excluir Venda"
                    size="sm"
                >
                    <div className="space-y-4">
                        <p className="text-gray-600">Confirma exclusão desta venda cancelada?</p>
                        <ModalActions>
                            <Button variant="secondary" onClick={() => setVendaToDelete(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleDelete}>Excluir</Button>
                        </ModalActions>
                    </div>
                </Modal>
            </div>
        </div>
    )
}
