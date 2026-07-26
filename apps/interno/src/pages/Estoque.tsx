import { useState, useMemo } from 'react'
import { Package, AlertTriangle, Search, Filter, SlidersHorizontal } from 'lucide-react'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, PageSkeleton, Modal, ModalActions, Button, Input, EmptyState } from '../components/ui'
import { KpiCard } from '../components/dashboard/KpiCard'
import { KpiCardDesktop } from '../components/dashboard/KpiCardDesktop'
import { cn } from '@mont/shared'
import { useProdutos } from '../hooks/useProdutos'
import { useToast } from '../components/ui/Toast'
import { EstoqueDataGrid, estoqueStatus, type EstoqueStatus } from '../components/features/estoque/EstoqueDataGrid'
import type { DomainProduto } from '../types/domain'

type EstoqueFiltro = 'todos' | 'negativos' | 'baixo' | 'zerados'

// Filtros (reusados no branch mobile e no desktop).
const FILTROS = [
    { id: 'todos', label: 'Todos', icon: Filter },
    { id: 'negativos', label: 'Negativos', icon: AlertTriangle },
    { id: 'baixo', label: 'Baixo', icon: AlertTriangle },
    { id: 'zerados', label: 'Zerados', icon: Package },
] as const

// inputBase v2 do Design System (§4) — mesmo dos modais.
const inputBase =
    'flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background ' +
    'placeholder:text-muted-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const STATUS_LABEL: Record<EstoqueStatus, { label: string; cls: string }> = {
    negativo: { label: 'Negativo', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    zerado: { label: 'Zerado', cls: 'bg-muted text-muted-foreground border-border' },
    baixo: { label: 'Baixo', cls: 'bg-warning/10 text-warning-strong border-warning/20' },
    ok: { label: 'OK', cls: 'bg-success/10 text-success border-success/20' },
}

export function Estoque() {
    const { openDrawer } = useNavigationStore()
    const toast = useToast()
    const { produtos, loading, updateEstoque } = useProdutos(false)

    const [filtro, setFiltro] = useState<EstoqueFiltro>('todos')
    const [searchTerm, setSearchTerm] = useState('')

    // Modal "Ajustar contagem"
    const [ajusteTarget, setAjusteTarget] = useState<DomainProduto | null>(null)
    const [ajusteValor, setAjusteValor] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const negativosCount = useMemo(() => produtos.filter(p => (p.estoqueAtual ?? 0) < 0).length, [produtos])
    const baixoCount = useMemo(() => produtos.filter(p => estoqueStatus(p) === 'baixo').length, [produtos])

    const filtered = useMemo(() => {
        let result = produtos
        if (filtro === 'negativos') result = result.filter(p => (p.estoqueAtual ?? 0) < 0)
        else if (filtro === 'baixo') result = result.filter(p => estoqueStatus(p) === 'baixo')
        else if (filtro === 'zerados') result = result.filter(p => (p.estoqueAtual ?? 0) === 0)

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p =>
                p.nome.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term)
            )
        }
        return result
    }, [produtos, filtro, searchTerm])

    const openAjuste = (produto: DomainProduto) => {
        setAjusteTarget(produto)
        setAjusteValor(String(produto.estoqueAtual ?? 0))
    }

    const handleSalvarAjuste = async () => {
        if (!ajusteTarget) return
        const qtd = parseInt(ajusteValor, 10)
        if (isNaN(qtd)) {
            toast.error('Informe uma quantidade válida')
            return
        }
        setIsSaving(true)
        try {
            await updateEstoque(ajusteTarget.id, qtd)
            toast.success(`Estoque de ${ajusteTarget.nome} ajustado para ${qtd}`)
            setAjusteTarget(null)
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Erro ao ajustar estoque')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <Header
                title="Estoque"
                showMenu
                centerTitle
                onMenuClick={openDrawer}
            />
            <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                <div className="space-y-4">
                    {loading && <PageSkeleton rows={10} showHeader showCards />}

                    {!loading && (
                        <>
                            {/* KPIs — MOBILE (<lg): compact (intocado) */}
                            <div className="grid grid-cols-3 gap-3 lg:hidden">
                                <KpiCard title="Produtos" value={produtos.length.toString()} progress={100} trend="Ativos" icon={Package} variant="compact" />
                                <KpiCard
                                    title="Negativos"
                                    value={negativosCount.toString()}
                                    progress={produtos.length > 0 ? (negativosCount / produtos.length) * 100 : 0}
                                    icon={AlertTriangle}
                                    variant="compact"
                                    onClick={() => setFiltro('negativos')}
                                    className="cursor-pointer"
                                />
                                <KpiCard
                                    title="Baixo Estoque"
                                    value={baixoCount.toString()}
                                    progress={produtos.length > 0 ? (baixoCount / produtos.length) * 100 : 0}
                                    icon={AlertTriangle}
                                    variant="compact"
                                    onClick={() => setFiltro('baixo')}
                                    className="cursor-pointer"
                                />
                            </div>

                            {/* KPIs — DESKTOP (≥lg): padrão v2 (igual Fluxo/Dashboard) */}
                            <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
                                <KpiCardDesktop title="Produtos" value={produtos.length.toString()} subtitle="Ativos no catálogo" />
                                <KpiCardDesktop
                                    title="Negativos"
                                    value={negativosCount.toString()}
                                    subtitle={negativosCount > 0 ? 'Toque para filtrar' : 'Nenhum negativo'}
                                    onClick={() => setFiltro('negativos')}
                                />
                                <KpiCardDesktop
                                    title="Baixo estoque"
                                    value={baixoCount.toString()}
                                    subtitle={baixoCount > 0 ? 'Toque para filtrar' : 'Tudo acima do mínimo'}
                                    onClick={() => setFiltro('baixo')}
                                />
                            </div>

                            {/* Busca + filtros — MOBILE (<lg): intocado */}
                            <div className="space-y-4 lg:hidden">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar produto ou código..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                        aria-label="Buscar no estoque"
                                    />
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {FILTROS.map((btn) => {
                                        const Icon = btn.icon
                                        const isSelected = filtro === btn.id
                                        return (
                                            <button
                                                key={btn.id}
                                                onClick={() => setFiltro(btn.id)}
                                                className={cn(
                                                    "flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-full text-xs font-bold whitespace-nowrap border transition-all active:scale-95",
                                                    isSelected
                                                        ? "bg-foreground text-background border-foreground shadow-card"
                                                        : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {btn.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Busca + filtros — DESKTOP (≥lg): toolbar em linha, sem scroll */}
                            <div className="hidden lg:flex lg:items-center lg:gap-3">
                                <div className="relative flex-1 lg:max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar produto ou código..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={cn(inputBase, 'h-11 pl-10 pr-4 text-sm')}
                                        aria-label="Buscar no estoque"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {FILTROS.map((btn) => {
                                        const Icon = btn.icon
                                        const isSelected = filtro === btn.id
                                        return (
                                            <button
                                                key={btn.id}
                                                onClick={() => setFiltro(btn.id)}
                                                className={cn(
                                                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold whitespace-nowrap transition-colors",
                                                    isSelected
                                                        ? "bg-foreground text-background border-foreground"
                                                        : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                                                )}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {btn.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {filtered.length === 0 ? (
                                <EmptyState
                                    icon={<Package className="w-12 h-12 text-muted-foreground" />}
                                    title="Nenhum produto encontrado"
                                    description="Ajuste a busca ou o filtro."
                                />
                            ) : (
                                <>
                                    {/* MOBILE (<lg): cards */}
                                    <div className="space-y-3 lg:hidden">
                                        {filtered.map((produto) => {
                                            const atual = produto.estoqueAtual ?? 0
                                            const st = estoqueStatus(produto)
                                            return (
                                                <Card key={produto.id} className="border border-border shadow-card">
                                                    <div className="p-4 flex items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h3 className="font-bold text-foreground truncate">{produto.nome}</h3>
                                                            <div className="text-xs text-muted-foreground font-mono">#{produto.codigo}</div>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium", STATUS_LABEL[st].cls)}>
                                                                    {STATUS_LABEL[st].label}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground">mín: {produto.estoqueMinimo ?? 0}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                                            <span className={cn("text-2xl font-black tabular-nums", atual < 0 ? "text-destructive" : "text-foreground")}>{atual}</span>
                                                            <Button size="sm" variant="outline" className="h-8" leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />} onClick={() => openAjuste(produto)}>
                                                                Ajustar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            )
                                        })}
                                    </div>

                                    {/* DESKTOP (≥lg): Data Grid */}
                                    <div className="hidden lg:block">
                                        <EstoqueDataGrid produtos={filtered} onAjustar={openAjuste} />
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </PageContainer>

            {/* Modal: Ajustar contagem */}
            <Modal
                isOpen={!!ajusteTarget}
                onClose={() => !isSaving && setAjusteTarget(null)}
                title="Ajustar Estoque"
                size="sm"
            >
                {ajusteTarget && (
                    <div className="space-y-4">
                        <div className="p-4 bg-muted/50 rounded-xl border border-border">
                            <p className="font-bold text-foreground">{ajusteTarget.nome}</p>
                            <p className="text-xs text-muted-foreground font-mono">#{ajusteTarget.codigo}</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Estoque atual: <span className={cn("font-bold", (ajusteTarget.estoqueAtual ?? 0) < 0 ? "text-destructive" : "text-foreground")}>{ajusteTarget.estoqueAtual ?? 0}</span>
                            </p>
                        </div>
                        <Input
                            label="Nova contagem (quantidade real)"
                            type="number"
                            value={ajusteValor}
                            onChange={(e) => setAjusteValor(e.target.value)}
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            Define o valor absoluto do estoque (use a contagem física real).
                        </p>
                        <ModalActions>
                            <Button variant="ghost" onClick={() => setAjusteTarget(null)} disabled={isSaving}>Cancelar</Button>
                            <Button variant="primary" onClick={handleSalvarAjuste} isLoading={isSaving}>Salvar</Button>
                        </ModalActions>
                    </div>
                )}
            </Modal>
        </>
    )
}
