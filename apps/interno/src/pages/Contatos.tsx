import { useState, useMemo } from 'react'
import { Plus, Search, Diamond, Flame, History, Users, X, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useNavigationStore } from '@/stores/useNavigationStore'
import { PageContainer } from '../components/layout/PageContainer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState, PageSkeleton, Pagination, paginateArray } from '../components/ui'
import { ContatoCard, ContatoFormModal, ContactStoryFilter } from '../components/contatos'
import { useContatos } from '../hooks/useContatos'
import { useDebounce } from '../hooks/useDebounce'

// Types for the filter stories
type FilterStoryId = 'all' | 'clients' | 'hot-leads' | 'inactives' | 'vips' | 'new'

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

    const { contatos, loading, error, refetch } = useContatos({
        filtros: {
            busca: debouncedSearchTerm,
            status: activeStory === 'all' ? 'todos' :
                activeStory === 'clients' ? 'cliente' :
                    activeStory === 'hot-leads' ? 'lead' :
                        activeStory === 'inactives' ? 'inativo' : 'todos',
            tipo: activeStory === 'vips' ? 'B2B' : 'todos',
            origem: 'todos',
        }
    })

    // Calculate dynamic counts for stories
    const stats = useMemo(() => {
        return {
            all: contatos.length,
            clients: contatos.filter(c => c.status === 'cliente').length,
            hot: contatos.filter(c => c.status === 'lead').length,
            inactive: contatos.filter(c => c.status === 'inativo').length,
            vip: contatos.filter(c => c.status === 'cliente' && c.tipo === 'B2B').length // Simple logic for VIP for now
        }
    }, [contatos])

    const storyItems = [
        { id: 'all', label: 'Todos', icon: Users, count: stats.all, color: 'primary' as const },
        { id: 'clients', label: 'Clientes', icon: UserCheck, count: stats.clients, color: 'success' as const },
        { id: 'hot-leads', label: 'Leads', icon: Flame, count: stats.hot, color: 'warning' as const },
        { id: 'vips', label: 'VIPs', icon: Diamond, count: stats.vip, color: 'purple' as const },
        { id: 'inactives', label: 'Inativos', icon: History, count: stats.inactive, color: 'info' as const },
    ]

    // Filter logic (Note: Search is now handled server-side)
    const filteredContatos = useMemo(() => {
        let result = contatos

        // We still keep story filters here for immediate UI feedback if needed, 
        // but the hook already filters by status. 
        // We only need to handle the 'vips' story which is a custom combination.
        if (activeStory === 'vips') {
            result = result.filter(c => c.status === 'cliente' && c.tipo === 'B2B')
        }

        return result
    }, [contatos, activeStory])

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
                            <Button
                                aria-label="Adicionar contato"
                                variant="default"
                                size="icon"
                                onClick={() => setIsModalOpen(true)}
                            >
                                <Plus className="h-6 w-6" />
                            </Button>
                            <Button
                                aria-label={showSearch ? 'Fechar busca' : 'Abrir busca'}
                                variant={showSearch ? 'accent' : 'ghost'}
                                size="icon"
                                onClick={() => setShowSearch(!showSearch)}
                            >
                                {showSearch ? <X className="h-6 w-6" /> : <Search className="h-6 w-6" />}
                            </Button>
                        </div>
                    }
                />

                {/* Search Bar Expandable */}
                <div className={`
                overflow-hidden transition-all duration-300 ease-in-out z-20 relative
                ${showSearch ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}
            `}>
                    <div className="px-4 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar por nome, apelido ou telefone..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1)
                                }}
                                autoFocus
                            />
                        </div>
                    </div>
                </div>

                <PageContainer className="relative z-10 space-y-6 pt-0 pb-24 bg-transparent px-4">

                    {/* Story Filters Carousel */}
                    <section className="bg-white dark:bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                        <ContactStoryFilter
                            items={storyItems}
                            activeId={activeStory}
                            onSelect={(id) => {
                                setActiveStory(id as FilterStoryId)
                                setCurrentPage(1)
                            }}
                        />
                    </section>

                    {/* Main List Header */}
                    {/* Main List Header */}
                    <div className="flex items-center justify-between px-1 mb-2">
                        <div className="flex items-center gap-2">
                            <div className="size-4 text-primary font-bold flex items-center justify-center">
                                {/* Dynamic Icon based on filter */}
                                {activeStory === 'all' && <Users className="size-4" />}
                                {activeStory === 'clients' && <UserCheck className="size-4" />}
                                {activeStory === 'hot-leads' && <Flame className="size-4" />}
                                {activeStory === 'inactives' && <History className="size-4" />}
                                {activeStory === 'vips' && <Diamond className="size-4" />}
                            </div>
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                                {activeStory === 'all' ? 'Todos os Contatos' :
                                    activeStory === 'clients' ? 'Meus Clientes' :
                                        activeStory === 'hot-leads' ? 'Leads Quentes' :
                                            activeStory === 'inactives' ? 'Recuperação' : 'Clientes VIP'}
                            </h2>
                        </div>


                    </div>

                    {/* Loading State */}
                    {loading && <PageSkeleton rows={12} showHeader showCards />}

                    {/* Error State */}
                    {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Contact List */}
                    {!loading && !error && (
                        filteredContatos.length > 0 ? (
                            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                                {paginatedContatos.map((contato) => (
                                    <ContatoCard
                                        key={contato.id}
                                        contato={contato}
                                        nomeIndicador={contato.indicador?.nome}
                                    />
                                ))}
                            </div>
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

                    {/* Pagination */}
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredContatos.length}
                        pageSize={PAGE_SIZE}
                        onPageChange={setCurrentPage}
                    />

                    <ContatoFormModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSuccess={() => refetch()}
                    />
                </PageContainer>
        </>
    )
}
