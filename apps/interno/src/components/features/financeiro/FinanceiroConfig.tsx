import { useState } from 'react'
import { Building2, LayoutGrid, Plus, FileText, ChevronRight, Pencil, Archive, Scale } from 'lucide-react'
import { Button, ConfirmDialog } from '../../ui'
import { useToast } from '../../ui/Toast'
import { PlanoContaModal } from './PlanoContaModal'
import { ContaModal } from './ContaModal'
import { EditContaModal, type EditContaPatch } from './EditContaModal'
import { AjustarSaldoModal } from './AjustarSaldoModal'
import { cashFlowService } from '../../../services/cashFlowService'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import type { Conta, PlanoConta } from '@mont/shared'

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
    const toast = useToast()
    const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('contas')
    const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false)
    const [isContaModalOpen, setIsContaModalOpen] = useState(false)
    const [editConta, setEditConta] = useState<Conta | null>(null)
    const [ajustarConta, setAjustarConta] = useState<Conta | null>(null)
    const [desativarTarget, setDesativarTarget] = useState<Conta | null>(null)
    const [isDesativando, setIsDesativando] = useState(false)

    const handleSaveConta = async (id: string, patch: EditContaPatch) => {
        await cashFlowService.updateConta(id, patch)
        toast.success('Conta atualizada!')
        refreshAll()
    }

    const handleAjustarSaldo = async (contaId: string, saldoReal: number) => {
        const lancId = await cashFlowService.ajustarSaldoConta(contaId, saldoReal)
        toast.success(lancId ? 'Saldo reconciliado!' : 'O saldo já batia — nada lançado.')
        refreshAll()
    }

    const handleDesativar = async () => {
        if (!desativarTarget) return
        try {
            setIsDesativando(true)
            await cashFlowService.desativarConta(desativarTarget.id)
            toast.success('Conta desativada')
            setDesativarTarget(null)
            refreshAll()
        } catch (error) {
            console.error('[FinanceiroConfig] desativarConta failed:', error)
            toast.error('Erro ao desativar conta')
        } finally {
            setIsDesativando(false)
        }
    }

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
                                ? "bg-foreground text-background border-foreground shadow-card"
                                : "bg-card text-muted-foreground border-border hover:border-foreground/30"
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
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Minhas Contas</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl bg-card border-border text-[10px] font-black uppercase"
                            onClick={() => setIsContaModalOpen(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> Nova Conta
                        </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {loadingContas ? (
                            <div className="p-8 text-center text-muted-foreground animate-pulse uppercase font-black text-xs">Carregando contas...</div>
                        ) : contas.map(conta => (
                            <div key={conta.id} className="bg-card p-5 rounded-4xl border border-border shadow-card flex items-center justify-between gap-3">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground border border-border shrink-0">
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-black text-foreground leading-tight truncate">{conta.nome}</h3>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{conta.banco}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                        <p className="text-base font-black text-foreground">{formatCurrency(conta.saldo_atual ?? 0)}</p>
                                        <span className="text-[9px] font-black text-success uppercase">Ativo</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setAjustarConta(conta)}
                                            aria-label={`Ajustar saldo de ${conta.nome}`}
                                            title="Ajustar saldo (reconciliação)"
                                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                            <Scale className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditConta(conta)}
                                            aria-label={`Editar ${conta.nome}`}
                                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDesativarTarget(conta)}
                                            aria-label={`Desativar ${conta.nome}`}
                                            className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Categorias</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl bg-card border-border text-[10px] font-black uppercase"
                            onClick={() => setIsPlanoModalOpen(true)}
                        >
                            <Plus className="w-3 h-3 mr-1" /> Nova Categoria
                        </Button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {loadingPlano ? (
                            <div className="p-8 text-center text-muted-foreground animate-pulse uppercase font-black text-xs">Sincronizando categorias...</div>
                        ) : planoContas.map(item => (
                            <div key={item.id} className="bg-card p-4 rounded-2xl border border-border shadow-card flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                                        item.tipo === 'receita' ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                                    )}>
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-foreground leading-tight">{item.nome}</h4>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{item.tipo}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
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
            <EditContaModal
                isOpen={editConta !== null}
                conta={editConta}
                onClose={() => setEditConta(null)}
                onSave={handleSaveConta}
            />
            <AjustarSaldoModal
                isOpen={ajustarConta !== null}
                conta={ajustarConta}
                onClose={() => setAjustarConta(null)}
                onSave={handleAjustarSaldo}
            />
            <ConfirmDialog
                open={desativarTarget !== null}
                title="Desativar conta"
                message={`"${desativarTarget?.nome}" será desativada e sairá das listas e do saldo consolidado. O histórico de lançamentos é preservado (não é exclusão).`}
                confirmLabel="Desativar"
                variant="danger"
                isLoading={isDesativando}
                onConfirm={handleDesativar}
                onCancel={() => setDesativarTarget(null)}
            />
        </div>
    )
}
