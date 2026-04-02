import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { formatCurrency } from '@mont/shared'
import { LoadingScreen, Button, Drawer } from '../components/ui'
import { useVenda, useVendas } from '../hooks/useVendas'
import type { PagamentoFormData } from '../schemas/venda'
import { useToast } from '../components/ui/Toast'
import { PaymentSidebar } from '../components/features/vendas/PaymentSidebar'

// Sub-components
import { VendaReceipt } from '../components/features/vendas/VendaReceipt'
import { VendaAcoesPrincipais } from '../components/features/vendas/VendaAcoesPrincipais'
import { VendaInfoCliente } from '../components/features/vendas/VendaInfoCliente'
import { VendaMetaInfo } from '../components/features/vendas/VendaMetaInfo'
import { VendaAcoesSecundarias } from '../components/features/vendas/VendaAcoesSecundarias'
import { VendaModais } from '../components/features/vendas/VendaModais'

export function VendaDetalhe() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const toast = useToast()
    const { venda, loading, error, refetch } = useVenda(id)
    const { deleteVenda, cancelVenda, addPagamento, updateVendaStatus, deleteUltimoPagamento } = useVendas()

    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [showRevertModal, setShowRevertModal] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isCancelling, setIsCancelling] = useState(false)
    const [loadingAction, setLoadingAction] = useState(false)
    const [showUndoPaymentConfirm, setShowUndoPaymentConfirm] = useState(false)

    // Handlers
    const handleDelete = async () => {
        if (!venda) return
        setIsDeleting(true)
        const success = await deleteVenda(venda.id)
        if (success) {
            toast.success('Venda excluída com sucesso')
            navigate('/vendas')
        } else {
            toast.error('Erro ao excluir venda')
            setIsDeleting(false)
        }
    }

    const handleCancel = async () => {
        if (!venda) return
        setIsCancelling(true)
        const success = await cancelVenda(venda.id)
        if (success) {
            await refetch()
            setShowCancelModal(false)
            toast.success('Venda cancelada com sucesso')
        } else {
            toast.error('Erro ao cancelar venda')
        }
        setIsCancelling(false)
    }

    const handlePaymentConfirm = async (data: PagamentoFormData): Promise<boolean> => {
        if (!venda) return false
        const success = await addPagamento(venda.id, data)
        if (success) {
            await refetch()
            setShowPaymentModal(false)
            toast.success('Pagamento registrado!')
            return true
        } else {
            toast.error('Erro ao registrar pagamento')
            return false
        }
    }

    const handleEntregar = async () => {
        if (!venda) return
        if (venda.status === 'entregue') {
            setShowRevertModal(true)
            return
        }
        const success = await updateVendaStatus(venda.id, 'entregue')
        if (success) {
            await refetch()
            toast.success('Venda marcada como entregue!')
        } else {
            toast.error('Erro ao atualizar status')
        }
    }

    const handleRevertDelivery = async () => {
        if (!venda) return
        const success = await updateVendaStatus(venda.id, 'pendente')
        if (success) {
            await refetch()
            setShowRevertModal(false)
            toast.success('Entrega revertida para pendente')
        } else {
            toast.error('Erro ao reverter status')
        }
    }

    const handleDesfazerPagamento = async () => {
        if (!venda) return
        setLoadingAction(true)
        const success = await deleteUltimoPagamento(venda.id)
        if (success) {
            await refetch()
            toast.success('Pagamento desfeito com sucesso!')
        } else {
            toast.error('Erro ao desfazer pagamento')
        }
        setLoadingAction(false)
        setShowUndoPaymentConfirm(false)
    }

    const handleShare = async () => {
        if (!venda) return
        const text = `🛒 *Pedido #${venda.id.slice(0, 6)}*\n👤 Cliente: ${venda.contato?.nome}\n💰 Total: ${formatCurrency(venda.total)}`.trim()

        if (navigator.share) {
            try {
                await navigator.share({ title: `Pedido #${venda.id.slice(0, 6)}`, text })
            } catch (_err) { }
        } else {
            navigator.clipboard.writeText(text)
            toast.success('Copiado para área de transferência!')
        }
    }

    if (loading) return <LoadingScreen message="Carregando detalhes..." />
    if (error || !venda) return (
        <div className="p-4 text-center">
            <p className="text-red-500 mb-4">{error || 'Venda não encontrada'}</p>
            <Button onClick={() => navigate('/vendas')}>Voltar</Button>
        </div>
    )

    return (
        <>
            <Header
                title={`Pedido #${venda.id.slice(0, 6)}`}
                showBack
                className="bg-secondary/80 dark:bg-background/80 backdrop-blur-md border-b border-border"
                centerTitle
            />

            <main className="flex-1 flex flex-col pt-6 px-4 pb-24 w-full max-w-md mx-auto">
                <VendaReceipt venda={venda} />

                <VendaAcoesPrincipais 
                    venda={venda}
                    handleEntregar={handleEntregar}
                    setShowPaymentModal={setShowPaymentModal}
                    setShowUndoPaymentConfirm={setShowUndoPaymentConfirm}
                    loadingAction={loadingAction}
                />

                <VendaInfoCliente contato={venda.contato} />

                <VendaMetaInfo vendaId={venda.id} formaPagamento={venda.formaPagamento} />

                <VendaAcoesSecundarias
                    venda={venda}
                    handleShare={handleShare}
                    setShowDeleteModal={setShowDeleteModal}
                    setShowCancelModal={setShowCancelModal}
                />
            </main>

            <VendaModais
                showDeleteModal={showDeleteModal}
                setShowDeleteModal={setShowDeleteModal}
                handleDelete={handleDelete}
                isDeleting={isDeleting}
                showCancelModal={showCancelModal}
                setShowCancelModal={setShowCancelModal}
                handleCancel={handleCancel}
                isCancelling={isCancelling}
                showRevertModal={showRevertModal}
                setShowRevertModal={setShowRevertModal}
                handleRevertDelivery={handleRevertDelivery}
                showUndoPaymentConfirm={showUndoPaymentConfirm}
                setShowUndoPaymentConfirm={setShowUndoPaymentConfirm}
                handleDesfazerPagamento={handleDesfazerPagamento}
                loadingAction={loadingAction}
            />

            <Drawer
                isOpen={showPaymentModal && !!venda}
                onClose={() => setShowPaymentModal(false)}
                title="Registrar Pagamento"
                subtitle={venda?.contato?.nome || 'Cliente'}
            >
                {venda && (
                    <PaymentSidebar
                        onBack={() => setShowPaymentModal(false)}
                        onConfirm={handlePaymentConfirm}
                        vendaId={venda.id}
                        total={venda.total}
                        valorPago={venda.valorPago || 0}
                        historico={venda.pagamentos}
                    />
                )}
            </Drawer>
        </>
    )
}
