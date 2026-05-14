import { useState } from 'react'
import { createPortal } from 'react-dom'
import { PageContainer } from '../components/layout/PageContainer'
import { Header } from '../components/layout/Header'
import { Plus, LayoutGrid, FileText } from 'lucide-react'
import { usePlanoDeContas } from '../hooks/usePlanoDeContas'
import { PlanoContaModal } from '../components/features/financeiro/PlanoContaModal'

export function PlanoDeContas() {
    const { planoContas, isLoading } = usePlanoDeContas()
    const [activeTab, setActiveTab] = useState<'receita' | 'despesa'>('receita')
    const [isModalOpen, setIsModalOpen] = useState(false)

    const filteredPlano = planoContas.filter(item => item.tipo === activeTab)

    return (
        <PageContainer className="pb-24">
            <Header title="Plano de Contas" showBack centerTitle />

            <div className="px-4 py-6">
                {/* Tabs */}
                <div className="flex bg-card rounded-xl p-1 shadow-sm mb-6 border border-border">
                    <button
                        onClick={() => setActiveTab('receita')}
                        className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'receita'
                            ? 'bg-success/10 text-success shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Receitas
                    </button>
                    <button
                        onClick={() => setActiveTab('despesa')}
                        className={`flex-1 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === 'despesa'
                            ? 'bg-destructive/10 text-destructive shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Despesas
                    </button>
                </div>

                {/* List */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                            <p>Carregando categorias...</p>
                        </div>
                    ) : filteredPlano.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                            <LayoutGrid size={48} className="mb-4 opacity-20" />
                            <p>Nenhuma categoria encontrada</p>
                        </div>
                    ) : (
                        filteredPlano.map((item) => (
                            <div
                                key={item.id}
                                className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.tipo === 'receita' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                        }`}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{item.nome}</h3>
                                        <span className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
                                            {item.categoria}
                                        </span>
                                    </div>
                                </div>
                                {!item.ativo && (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase">
                                        Inativo
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* FAB — portaled to escape stacking context */}
            {createPortal(
                <button
                    aria-label="Nova categoria"
                    onClick={() => setIsModalOpen(true)}
                    className="fixed right-6 bottom-24 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[9997]"
                >
                    <Plus size={24} />
                </button>,
                document.body
            )}

            <PlanoContaModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                defaultType={activeTab}
            />
        </PageContainer>
    )
}
