import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, Diamond, Flame, History, Users, X, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState, PageSkeleton, Pagination, paginateArray } from '../components/ui'
import { ContatoCard, ContatoFormModal, ContactStoryFilter, ContatosFilterTabs, ContatosDataGrid } from '../components/contatos'
import { useContatos } from '../hooks/useContatos'
import { useContatosResumo } from '../hooks/useContatosResumo'
import { useContatosRitmo } from '../hooks/useContatosRitmo'
import { useDebounce } from '../hooks/useDebounce'
import { classificarContato, type SegmentoCliente } from '../utils/segmentoCliente'

// Filtros = segmentos do funil, derivados do comportamento de compra (não do campo `status`).
type FilterStoryId = 'all' | 'clientes' | 'leads' | 'vips' | 'inativos'

const STORY_TO_SEGMENTO: Record<Exclude<FilterStoryId, 'all'>, SegmentoCliente> = {
    clientes: 'cliente',
    leads: 'lead',
    vips: 'vip',
    inativos: 'inativo',
}

export function Contatos() {
    const [searchTerm, setSearchTerm] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [activeStory, setActiveStory] = useState<FilterStoryId>('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const { openDrawer } = useNavigationStore()
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 30

    // Advanced Search Logic (Server-side)
    const debouncedSearchTerm = useDebounce(searchTerm, 500)

    // Ao abrir a busca (a barra colapsa via max-h, o input fica montado), foca o
    // campo pra já poder digitar sem clicar. rAF garante o foco após a expansão.
    const searchInputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (showSearch) requestAnimationFrame(() => searchInputRef.current?.focus())
    }, [showSearch])

    const resumo = useContatosResumo()
    const ritmo = useContatosRitmo()

    // Carrega todos (a busca segue server-side); o filtro de segmento é client-side.
    const { contatos, loading, error, refetch } = useContatos({
        filtros: { busca: debouncedSearchTerm, status: 'todos', tipo: 'todos', origem: 'todos' }
    })

    // Segmento derivado por contato — uma única data de referência por render.
    const hoje = useMemo(() => new Date(), [])
    const segmentoDe = useMemo(
        () => new Map(contatos.map(c => [c.id, classificarContato(c, resumo.get(c.id), hoje)])),
        [contatos, resumo, hoje],
    )

    // Counts por segmento
    const stats = useMemo(() => {
        const s = { all: contatos.length, clientes: 0, leads: 0, vips: 0, inativos: 0 }
        for (const seg of segmentoDe.values()) {
            if (seg === 'cliente') s.clientes++
            else if (seg === 'lead') s.leads++
            else if (seg === 'vip') s.vips++
            else if (seg === 'inativo') s.inativos++
        }
        return s
    }, [contatos.length, segmentoDe])

    const storyItems = [
        { id: 'all', label: 'Todos', icon: Users, count: stats.all, color: 'primary' as const },
        { id: 'clientes', label: 'Clientes', icon: UserCheck, count: stats.clientes, color: 'success' as const },
        { id: 'leads', label: 'Leads', icon: Flame, count: stats.leads, color: 'warning' as const },
        { id: 'vips', label: 'VIPs', icon: Diamond, count: stats.vips, color: 'purple' as const },
        { id: 'inativos', label: 'Inativos', icon: History, count: stats.inativos, color: 'info' as const },
    ]

    // Filtro por segmento (client-side; a busca já veio do servidor)
    const filteredContatos = useMemo(() => {
        if (activeStory === 'all') return contatos
        const alvo = STORY_TO_SEGMENTO[activeStory]
        return contatos.filter(c => segmentoDe.get(c.id) === alvo)
    }, [contatos, activeStory, segmentoDe])

    // Reset page when filters/search change
    // Reset page when filters change - removed to avoid set-state-in-effect
    // Logic will be handled in the setters
    // useEffect(() => {
    //     setCurrentPage(1)
    // }, [activeStory, debouncedSearchTerm])

    // Client-side pagination (temporary — server-side in UX-S005-v2)
    const paginatedContatos = paginateArray(filteredContatos, currentPage, PAGE_SIZE)

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
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1)
                                }}
                            />
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
                                setCurrentPage(1)
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
                                setCurrentPage(1)
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
                            </div>
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                                {activeStory === 'all' ? 'Todos os Contatos' :
                                    activeStory === 'clientes' ? 'Meus Clientes' :
                                        activeStory === 'leads' ? 'Leads' :
                                            activeStory === 'inativos' ? 'Recuperação' : 'Clientes VIP'}
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
                        filteredContatos.length > 0 ? (
                            <>
                                {/* MOBILE (<lg): grade de cards + paginação — intocada (mobile sagrado) */}
                                <div className="space-y-4 lg:hidden">
                                    {paginatedContatos.map((contato) => (
                                        <ContatoCard
                                            key={contato.id}
                                            contato={contato}
                                            nomeIndicador={contato.indicador?.nome}
                                            segmento={segmentoDe.get(contato.id)}
                                            ritmo={ritmo.get(contato.id)}
                                        />
                                    ))}
                                    <Pagination
                                        currentPage={currentPage}
                                        totalItems={filteredContatos.length}
                                        pageSize={PAGE_SIZE}
                                        onPageChange={setCurrentPage}
                                    />
                                </div>

                                {/* DESKTOP (≥lg): data grid denso — sort + paginação próprios sobre o conjunto filtrado inteiro */}
                                <div className="hidden lg:block">
                                    <ContatosDataGrid contatos={filteredContatos} resumo={resumo} ritmo={ritmo} />
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
