import { useState, useRef, useEffect } from 'react'
import type { PaginationState, SortingState, Updater } from '@tanstack/react-table'
import { Plus, Search, Diamond, Flame, History, Users, X, UserCheck, Sparkles } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState, PageSkeleton, Pagination } from '../components/ui'
import { Badge } from '@/components/ui/Badge'
import { isBuscaExata } from '../utils/telefone'
import { ContatoCard, ContatoFormModal, ContactStoryFilter, ContatosFilterTabs, ContatosDataGrid } from '../components/contatos'
import { useDebounce } from '../hooks/useDebounce'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useContagemContatos, useListaContatos } from '../hooks/useContatosSegmento'
import { ordemDaGrade, ORDEM_PADRAO_CONTATOS, type FiltroContatos } from '../services/contatosSegmentoService'

// Filtros = segmentos do funil, derivados do comportamento de compra (não do campo `status`).
// A exceção é `novos-ia`, que não é segmento nenhum: é a fila de cadastros que a
// secretária de WhatsApp criou e ninguém conferiu ainda (ver utils/filaRevisao).
// Segmento, contadores, filtro, ordenação e paginação são feitos no banco
// (view_contatos_segmento) — a tabela passou de 1000 linhas, o limite por requisição.
type FilterStoryId = FiltroContatos

export function Contatos() {
    const [searchTerm, setSearchTerm] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [activeStory, setActiveStory] = useState<FilterStoryId>('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { openDrawer } = useNavigationStore()
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 30
    const isDesktop = useIsDesktop()
    // Desktop: a grade ordena e pagina no servidor; o estado mora aqui para virar consulta.
    const [sorting, setSorting] = useState<SortingState>([{ id: 'nome', desc: false }])
    const [paginacao, setPaginacao] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 })

    // Advanced Search Logic (Server-side)
    const debouncedSearchTerm = useDebounce(searchTerm, 500)

    // Ao abrir a busca (a barra colapsa via max-h, o input fica montado), foca o
    // campo pra já poder digitar sem clicar. rAF garante o foco após a expansão.
    const searchInputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (showSearch) requestAnimationFrame(() => searchInputRef.current?.focus())
    }, [showSearch])

    // Contadores contados no banco, com a mesma busca da lista (reagem à busca, como sempre).
    const stats = useContagemContatos(debouncedSearchTerm)

    // Só a página visível. Celular: páginas de 30, mais novos primeiro. Desktop: a grade.
    const lista = useListaContatos(
        isDesktop
            ? { busca: debouncedSearchTerm, filtro: activeStory, ordem: ordemDaGrade(sorting), pagina: paginacao.pageIndex, tamanho: paginacao.pageSize }
            : { busca: debouncedSearchTerm, filtro: activeStory, ordem: ORDEM_PADRAO_CONTATOS, pagina: currentPage - 1, tamanho: PAGE_SIZE },
    )
    const contatos = lista.data?.linhas ?? []
    const total = lista.data?.total ?? 0
    const loading = lista.isLoading
    const error = lista.error ? lista.error.message : null
    const refetch = lista.refetch

    // Busca, filtro ou ordenação novos voltam para a 1ª página (nos dois layouts).
    const voltarParaPrimeiraPagina = () => {
        setCurrentPage(1)
        setPaginacao((p) => ({ ...p, pageIndex: 0 }))
    }
    const onSortingChange = (updater: Updater<SortingState>) => {
        setSorting(updater)
        setPaginacao((p) => ({ ...p, pageIndex: 0 }))
    }

    const storyItems = [
        { id: 'all', label: 'Todos', icon: Users, count: stats.all, color: 'primary' as const },
        { id: 'clientes', label: 'Clientes', icon: UserCheck, count: stats.clientes, color: 'success' as const },
        { id: 'leads', label: 'Leads', icon: Flame, count: stats.leads, color: 'warning' as const },
        { id: 'vips', label: 'VIPs', icon: Diamond, count: stats.vips, color: 'purple' as const },
        { id: 'inativos', label: 'Inativos', icon: History, count: stats.inativos, color: 'info' as const },
        // Só aparece quando há trabalho: com a fila zerada a barra fica como sempre foi.
        ...(stats.novosIa > 0
            ? [{ id: 'novos-ia', label: 'Novos da IA', icon: Sparkles, count: stats.novosIa, color: 'warning' as const }]
            : []),
    ]


    return (
        <>
            <Header
                    title="Gestão de Clientes"
                    centerTitle
                    showMenu
                    onMenuClick={openDrawer}
                    rightAction={
                        <div className="flex items-center gap-2">
                            {/* Mobile: "+" icon-only (sagrado) */}
                            <Button
                                aria-label="Adicionar contato"
                                variant="default"
                                size="icon"
                                className="lg:hidden"
                                onClick={() => setIsModalOpen(true)}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                            {/* Desktop: botão rotulado */}
                            <Button
                                variant="default"
                                leftIcon={<Plus className="h-5 w-5" />}
                                className="hidden lg:inline-flex"
                                onClick={() => setIsModalOpen(true)}
                            >
                                Novo cliente
                            </Button>
                            {/* Toggle de busca — só mobile; no desktop a busca fica sempre visível */}
                            <Button
                                aria-label={showSearch ? 'Fechar busca' : 'Abrir busca'}
                                variant={showSearch ? 'accent' : 'ghost'}
                                size="icon"
                                className="lg:hidden"
                                onClick={() => setShowSearch(!showSearch)}
                            >
                                {showSearch ? <X className="h-6 w-6" /> : <Search className="h-6 w-6" />}
                            </Button>
                        </div>
                    }
                />

                {/* Search Bar — colapsável no mobile (toggle), sempre aberta no desktop (lg) */}
                <div className={`
                overflow-hidden transition-all duration-300 ease-in-out z-20 relative
                ${showSearch ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}
                lg:max-h-20 lg:opacity-100
            `}>
                    <div className="px-4 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Buscar por nome, apelido ou telefone..."
                                className={isBuscaExata(searchTerm) ? 'pl-10 pr-32' : 'pl-10'}
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    voltarParaPrimeiraPagina()
                                }}
                            />
                            {/* Espaço no fim = palavra exata. Sem o chip o resultado encolhe sem explicação. */}
                            {isBuscaExata(searchTerm) && (
                                <Badge
                                    variant="secondary"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-normal"
                                >
                                    palavra exata
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                <PageContainer className="relative z-10 space-y-6 pt-0 pb-24 bg-transparent px-4">

                    {/* MOBILE (<lg): carrossel de stories — intocado (mobile sagrado) */}
                    <section className="bg-card rounded-2xl p-4 shadow-card border border-border/50 lg:hidden">
                        <ContactStoryFilter
                            items={storyItems}
                            activeId={activeStory}
                            onSelect={(id) => {
                                setActiveStory(id as FilterStoryId)
                                voltarParaPrimeiraPagina()
                            }}
                        />
                    </section>

                    {/* DESKTOP (≥lg): filtros como tabs (segmented control) */}
                    <div className="hidden lg:block">
                        <ContatosFilterTabs
                            items={storyItems}
                            activeId={activeStory}
                            onSelect={(id) => {
                                setActiveStory(id as FilterStoryId)
                                voltarParaPrimeiraPagina()
                            }}
                        />
                    </div>

                    {/* Main List Header */}
                    {/* Main List Header */}
                    <div className="flex items-center justify-between px-1 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="size-4 text-primary font-bold flex items-center justify-center">
                                {/* Dynamic Icon based on filter */}
                                {activeStory === 'all' && <Users className="size-4" />}
                                {activeStory === 'clientes' && <UserCheck className="size-4" />}
                                {activeStory === 'leads' && <Flame className="size-4" />}
                                {activeStory === 'inativos' && <History className="size-4" />}
                                {activeStory === 'vips' && <Diamond className="size-4" />}
                                {activeStory === 'novos-ia' && <Sparkles className="size-4" />}
                            </div>
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                                {activeStory === 'all' ? 'Todos os Contatos' :
                                    activeStory === 'clientes' ? 'Meus Clientes' :
                                        activeStory === 'leads' ? 'Leads' :
                                            activeStory === 'inativos' ? 'Recuperação' :
                                                activeStory === 'novos-ia' ? 'Capturados pela secretária — confira o cadastro' : 'Clientes VIP'}
                            </h2>
                        </div>


                    </div>

                    {/* Loading State */}
                    {loading && <PageSkeleton rows={12} showHeader showCards />}

                    {/* Error State */}
                    {error && (
                        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Contact List */}
                    {!loading && !error && (
                        total > 0 ? (
                            <>
                                {/* MOBILE (<lg): grade de cards + paginação — intocada (mobile sagrado) */}
                                <div className="space-y-4 lg:hidden">
                                    {contatos.map((contato) => (
                                        <ContatoCard
                                            key={contato.id}
                                            contato={contato}
                                            nomeIndicador={contato.indicador?.nome}
                                            segmento={contato.segmento}
                                            ritmo={contato.ritmo}
                                        />
                                    ))}
                                    <Pagination
                                        currentPage={currentPage}
                                        totalItems={total}
                                        pageSize={PAGE_SIZE}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>

                                {/* DESKTOP (≥lg): data grid denso — ordenação e paginação no servidor */}
                                <div className="hidden lg:block">
                                    <ContatosDataGrid
                                        contatos={contatos}
                                        total={total}
                                        sorting={sorting}
                                        onSortingChange={onSortingChange}
                                        pagination={paginacao}
                                        onPaginationChange={setPaginacao}
                                    />
                                </div>
                            </>
                        ) : (
                            <EmptyState
                                icon={<Users className="h-12 w-12 text-muted-foreground" />}
                                title="Nenhum contato encontrado"
                                description="Tente ajustar os filtros ou adicione um novo contato."
                                action={
                                    <Button onClick={() => setIsModalOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Adicionar Contato
                                    </Button>
                                }
                            />
                        )
                    )}

                    <ContatoFormModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => refetch()}
                    />
                </PageContainer>
        </>
    )
}
