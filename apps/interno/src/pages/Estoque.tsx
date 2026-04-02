import React, { useState, Suspense } from 'react'
import { Box } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, PageSkeleton, WidgetSkeleton } from '../components/ui'
import { useProdutos } from '../hooks/useProdutos'
import { useToast } from '../components/ui/Toast'
import { EstoqueCard } from '../components/features/estoque/EstoqueCard'

// Lazy load do componente 3D para otimização de bundle (1.3MB)
const Estoque3DView = React.lazy(() => import('../components/features/estoque/Estoque3DView'))

export function Estoque() {
    const toast = useToast()
    const { produtos, loading, updateEstoque } = useProdutos(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const handleUpdateEstoque = async (id: string, delta: number) => {
        const produto = produtos.find(p => p.id === id)
        if (!produto) return

        const novoEstoque = Math.max(0, (produto.estoqueAtual || 0) + delta)
        setUpdatingId(id)

        const result = await updateEstoque(id, novoEstoque)
        setUpdatingId(null)

        if (!result) {
            toast.error('Erro ao atualizar estoque')
        }
    }

    // Filtrar só produtos de massa (1kg ou 4kg)
    const produtosMassa = produtos.filter(p =>
        p.nome.toLowerCase().includes('kg') ||
        p.codigo.includes('KG')
    )

    // Totais para exibição na legenda
    const total1kg = produtosMassa
        .filter(p => p.nome.toLowerCase().includes('1kg') || p.codigo.includes('1KG'))
        .reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)
    const total4kg = produtosMassa
        .filter(p => p.nome.toLowerCase().includes('4kg') || p.codigo.includes('4KG'))
        .reduce((acc, p) => acc + (p.estoqueAtual || 0), 0)

    if (loading) {
        return <PageSkeleton rows={8} />
    }

    return (
        <>
            <Header title="Geladeira" showBack centerTitle />
                
                <div className="flex flex-col h-[calc(100dvh-4rem)]">
                    {/* Cena 3D - Split do bundle aqui */}
                    <div className="h-[65vh] bg-gradient-to-b from-slate-50 to-gray-200 relative overflow-hidden group">
                        <Suspense fallback={
                            <WidgetSkeleton height="h-64" lines={3} />
                        }>
                            <Estoque3DView produtos={produtosMassa} />
                        </Suspense>

                        {/* Legenda flutuante */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
                            <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg px-4 py-2 rounded-2xl shadow-xl border border-white/20">
                                <div className="w-3.5 h-3.5 rounded-full bg-warning shadow-card" />
                                <span className="font-bold text-sm tracking-tight">1kg: {total1kg}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg px-4 py-2 rounded-2xl shadow-xl border border-white/20">
                                <div className="w-3.5 h-3.5 rounded-full bg-accent shadow-card" />
                                <span className="font-bold text-sm tracking-tight">4kg: {total4kg}</span>
                            </div>
                        </div>
                    </div>

                    {/* Controles de Estoque */}
                    <div className="flex-1 overflow-y-auto bg-card/50 backdrop-blur-sm">
                        <PageContainer className="py-6 pt-2 pb-24">
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h2 className="text-base font-bold text-gray-800 dark:text-gray-200">Painel de Estoque</h2>
                                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                                    {produtosMassa.length} Produtos
                                </span>
                            </div>

                            {produtosMassa.length === 0 ? (
                                <Card className="text-center py-12 text-gray-500 border-dashed border-2">
                                    <Box className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium">Nenhum produto de massa cadastrado</p>
                                    <p className="text-xs mt-2 px-6">
                                        Cadastre produtos com "1kg" ou "4kg" no nome para visualizar na geladeira.
                                    </p>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {produtosMassa.map(produto => (
                                        <EstoqueCard
                                            key={produto.id}
                                            produto={produto}
                                            onIncrement={() => handleUpdateEstoque(produto.id, 1)}
                                            onDecrement={() => handleUpdateEstoque(produto.id, -1)}
                                            isUpdating={updatingId === produto.id}
                                        />
                                    ))}
                                </div>
                            )}
                        </PageContainer>
                    </div>
                </div>
        </>
    )
}
