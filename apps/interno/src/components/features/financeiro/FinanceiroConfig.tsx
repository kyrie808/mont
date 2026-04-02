import { useState } from 'react'
import { Building2, LayoutGrid, Plus, FileText, ChevronRight } from 'lucide-react'
import { Button } from '../../ui'
import { PlanoContaModal } from './PlanoContaModal'
import { ContaModal } from './ContaModal'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { Conta, PlanoConta } from '@/types/database'

interface FinanceiroConfigProps {
    contas: Conta[]
    planoContas: PlanoConta[]
    loadingContas: boolean
    loadingPlano: boolean
    refreshAll: () => void
}

type SettingsTab = 'contas' | 'categorias'

export function FinanceiroConfig({
    contas,
    planoContas,
    loadingContas,
    loadingPlano,
    refreshAll
}: FinanceiroConfigProps) {
    const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('contas')
    const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false)
    const [isContaModalOpen, setIsContaModalOpen] = useState(false)

    return (
        <div className="px-4 py-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Settings Sub-tabs */}
            <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
                {[
                    { id: 'contas', label: 'Contas Bancárias', icon: Building2 },
                    { id: 'categorias', label: 'Plano de Contas', icon: LayoutGrid },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSettingsTab(tab.id as SettingsTab)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider border transition-all whitespace-nowrap",
                            activeSettingsTab === tab.id
                                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-lg shadow-zinc-900/10"
                                : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeSettingsTab === 'contas' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Minhas Contas</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase"
                            onClick={() => setIsContaModalOpen(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> Nova Conta
                        </Button>
                    </div>

                    <div className="grid gap-4">
                        {loadingContas ? (
                            <div className="p-8 text-center text-zinc-400 animate-pulse uppercase font-black text-xs">Carregando contas...</div>
                        ) : contas.map(conta => (
                            <div key={conta.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">{conta.nome}</h3>
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{conta.banco}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-zinc-900 dark:text-white">{formatCurrency(conta.saldo_atual ?? 0)}</p>
                                    <span className="text-[9px] font-black text-emerald-600 uppercase">Ativo</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Categorias</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase"
                            onClick={() => setIsPlanoModalOpen(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> Nova Categoria
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        {loadingPlano ? (
                            <div className="p-8 text-center text-zinc-400 animate-pulse uppercase font-black text-xs">Sincronizando categorias...</div>
                        ) : planoContas.map(item => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                                        item.tipo === 'receita' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                                    )}>
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-zinc-900 dark:text-white leading-tight">{item.nome}</h4>
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{item.tipo}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-zinc-300" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Config Modals */}
            <PlanoContaModal
                isOpen={isPlanoModalOpen}
                onClose={() => setIsPlanoModalOpen(false)}
                onSuccess={refreshAll}
            />
            <ContaModal
                isOpen={isContaModalOpen}
                onClose={() => setIsContaModalOpen(false)}
                onSuccess={refreshAll}
            />
        </div>
    )
}
