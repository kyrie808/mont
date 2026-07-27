import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigationStore } from '@/stores/useNavigationStore'
import {
    Package,
    Plus,
    AlertTriangle,
    Search,
    X
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, PageSkeleton, Modal, ModalActions, Button } from '../components/ui'
import { KpiCard } from '../components/dashboard/KpiCard'
import { KpiCardDesktop } from '../components/dashboard/KpiCardDesktop'
import { cn } from '@mont/shared'

// inputBase v2 do Design System (§4) — mesmo da toolbar do Estoque.
const inputBase =
    'flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background ' +
    'placeholder:text-muted-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
import { useProdutos } from '../hooks/useProdutos'
import { useToast } from '../components/ui/Toast'
import { formatCurrency } from '@mont/shared'
import { produtoService } from '../services/produtoService'
import type { DomainProduto, CreateProduto, UpdateProduto } from '../types/domain'
import { ProdutoFormFields } from '../components/features/produtos/ProdutoFormFields'
import { ProdutoFormDesktop } from '../components/features/produtos/ProdutoFormDesktop'
import { ProdutosDataGrid } from '../components/features/produtos/ProdutosDataGrid'
import { useSecoes } from '../hooks/useSecoes'
import { useIsDesktop } from '../hooks/useIsDesktop'


export function Produtos() {
    const { openDrawer } = useNavigationStore()
    const toast = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const { produtos, loading, createProduto, updateProduto } = useProdutos(true)
    const { secoes } = useSecoes()
    const secaoOptions = secoes.map((s) => ({ value: s.id, label: s.nome }))
    const isDesktop = useIsDesktop()
    // Desktop v2 (2 colunas tokenizadas) × mobile sagrado (ProdutoFormFields, cores cruas).
    const FieldsComponent = isDesktop ? ProdutoFormDesktop : ProdutoFormFields

    // Filters
    // `?filtro=baixo_estoque` continua vivo só pro atalho mobile (KPI que o Gilmar já usa).
    const filterBaixoEstoque = searchParams.get('filtro') === 'baixo_estoque'
    // Busca (desktop) por nome/código — no mobile o campo não existe, então fica vazio (sem efeito).
    const [searchTerm, setSearchTerm] = useState('')

    const filteredProdutos = useMemo(() => {
        let result = produtos

        if (filterBaixoEstoque) {
            result = result.filter(p => {
                const atual = p.estoqueAtual || 0
                const minimo = p.estoqueMinimo || 10
                return atual <= minimo && p.ativo
            })
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p =>
                p.nome.toLowerCase().includes(term) ||
                p.codigo.toLowerCase().includes(term)
            )
        }
        return result
    }, [produtos, filterBaixoEstoque, searchTerm])

    const clearFilter = () => {
        setSearchParams(prev => {
            prev.delete('filtro')
            return prev
        })
    }

    // Modal states
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingProduto, setEditingProduto] = useState<DomainProduto | null>(null)

    // Form states for create
    const [newNome, setNewNome] = useState('')
    const [newCodigo, setNewCodigo] = useState('')
    const [newApelido, setNewApelido] = useState('')
    const [newSubtitulo, setNewSubtitulo] = useState('')
    const [newPreco, setNewPreco] = useState('')
    const [newCusto, setNewCusto] = useState('')
    const [newUnidade, setNewUnidade] = useState('kg')
    const [newEstoqueMinimo, setNewEstoqueMinimo] = useState('10')
    const [newCategoria, setNewCategoria] = useState('')
    const [newDescricao, setNewDescricao] = useState('')
    const [newPesoKg, setNewPesoKg] = useState('')
    const [newSlug, setNewSlug] = useState('')
    const [newInstrucoesPreparo, setNewInstrucoesPreparo] = useState('')
    const [newBeneficios, setNewBeneficios] = useState('')
    const [newDestaque, setNewDestaque] = useState(false)
    const [newSelo, setNewSelo] = useState('')
    const [newVisivelCatalogo, setNewVisivelCatalogo] = useState(true)
    const [newEhCombo, setNewEhCombo] = useState(false)
    const [newSecaoId, setNewSecaoId] = useState('')
    const [newComponentes, setNewComponentes] = useState<{ componenteId: string; quantidade: number }[]>([])
    const [isCreating, setIsCreating] = useState(false)

    // Form states for edit
    const [uploadingImage, setUploadingImage] = useState(false)
    const [editImagemUrl, setEditImagemUrl] = useState<string | null>(null)
    const [editNome, setEditNome] = useState('')
    const [editCodigo, setEditCodigo] = useState('')
    const [editApelido, setEditApelido] = useState('')
    const [editSubtitulo, setEditSubtitulo] = useState('')
    const [editPreco, setEditPreco] = useState('')
    const [editCusto, setEditCusto] = useState('')
    const [editEstoqueMinimo, setEditEstoqueMinimo] = useState('')
    const [editAtivo, setEditAtivo] = useState(true)
    const [editCategoria, setEditCategoria] = useState('')
    const [editUnidade, setEditUnidade] = useState('un')
    const [editPrecoAncoragem, setEditPrecoAncoragem] = useState('')
    const [editDescricao, setEditDescricao] = useState('')
    const [editPesoKg, setEditPesoKg] = useState('')
    const [editSlug, setEditSlug] = useState('')
    const [editInstrucoesPreparo, setEditInstrucoesPreparo] = useState('')
    const [editBeneficios, setEditBeneficios] = useState('')
    const [editDestaque, setEditDestaque] = useState(false)
    const [editSelo, setEditSelo] = useState('')
    const [editVisivelCatalogo, setEditVisivelCatalogo] = useState(true)
    const [editEhCombo, setEditEhCombo] = useState(false)
    const [editSecaoId, setEditSecaoId] = useState('')
    const [editComponentes, setEditComponentes] = useState<{ componenteId: string; quantidade: number }[]>([])
    const [isUpdating, setIsUpdating] = useState(false)

    // Picker de componentes (compartilhado — um modal aberto por vez)
    const [pickComponenteId, setPickComponenteId] = useState('')
    const [pickQuantidade, setPickQuantidade] = useState('1')

    // Stats
    const produtosAtivos = produtos.filter(p => p.ativo).length
    const produtosBaixoEstoqueCount = produtos.filter(p => {
        const atual = p.estoqueAtual || 0
        const minimo = p.estoqueMinimo || 10
        return atual <= minimo && p.ativo
    }).length
    // KPIs de cadastro (desktop) — estoque é preocupação do /estoque, não do cadastro.
    const combosCount = produtos.filter(p => p.ehCombo).length
    const foraCatalogoCount = produtos.filter(p => p.ativo && !p.visivelCatalogo).length

    // Custo de um combo = soma do custo dos componentes × quantidade (não digitado).
    const custoComponentes = (comps: { componenteId: string; quantidade: number }[]) =>
        comps.reduce((sum, c) => sum + (produtos.find(p => p.id === c.componenteId)?.custo ?? 0) * c.quantidade, 0)

    // Open edit modal
    const handleOpenEdit = (produto: DomainProduto) => {
        setEditingProduto(produto)
        setEditNome(produto.nome)
        setEditCodigo(produto.codigo)
        setEditApelido(produto.apelido || '')
        setEditSubtitulo(produto.subtitulo || '')
        setEditPreco(String(produto.preco))
        setEditCusto(String(produto.custo))
        setEditEstoqueMinimo(String(produto.estoqueMinimo || 10))
        setEditAtivo(produto.ativo)
        setEditCategoria(produto.categoria || '')
        setEditImagemUrl(produto.imagemUrl || null)
        setEditUnidade(produto.unidade || 'un')
        setEditPrecoAncoragem(produto.precoAncoragem?.toString() || '')
        setEditDescricao(produto.descricao || '')
        setEditPesoKg(produto.pesoKg != null ? String(produto.pesoKg) : '')
        setEditSlug(produto.slug || '')
        setEditInstrucoesPreparo(produto.instrucoesPreparo || '')
        setEditBeneficios(produto.beneficios || '')
        setEditDestaque(produto.destaque ?? false)
        setEditSelo(produto.selo ?? '')
        setEditVisivelCatalogo(produto.visivelCatalogo ?? true)
        setEditEhCombo(produto.ehCombo ?? false)
        setEditSecaoId(produto.secaoId ?? '')
        setPickComponenteId('')
        setPickQuantidade('1')
        // Carrega a composição existente (se for combo)
        setEditComponentes([])
        if (produto.ehCombo) {
            produtoService.getComponentes(produto.id)
                .then(comps => setEditComponentes(comps.map(c => ({ componenteId: c.componenteId, quantidade: c.quantidade }))))
                .catch(err => {
                    console.error('Erro ao carregar componentes do combo:', err)
                    toast.error('Não foi possível carregar os componentes do combo')
                })
        }
    }

    const handleCloseEdit = () => {
        setEditingProduto(null)
    }

    const handleOpenCreate = () => {
        setNewNome('')
        setNewCodigo('')
        setNewApelido('')
        setNewSubtitulo('')
        setNewPreco('')
        setNewCusto('')
        setNewUnidade('kg')
        setNewEstoqueMinimo('10')
        setNewCategoria('')
        setNewDescricao('')
        setNewPesoKg('')
        setNewSlug('')
        setNewInstrucoesPreparo('')
        setNewBeneficios('')
        setNewDestaque(false)
        setNewSelo('')
        setNewVisivelCatalogo(true)
        setNewEhCombo(false)
        setNewSecaoId('')
        setNewComponentes([])
        setPickComponenteId('')
        setPickQuantidade('1')
        setIsCreateModalOpen(true)
    }

    const handleCreate = async () => {
        if (!newNome.trim() || !newCodigo.trim()) {
            toast.error('Nome e código são obrigatórios')
            return
        }

        const preco = parseFloat(newPreco)
        // Combo: custo derivado dos componentes; produto simples: custo digitado.
        const custo = newEhCombo ? custoComponentes(newComponentes) : parseFloat(newCusto)

        if (isNaN(preco) || preco <= 0) {
            toast.error('Preço deve ser maior que zero')
            return
        }

        if (!newEhCombo && (isNaN(custo) || custo <= 0)) {
            toast.error('Custo deve ser maior que zero')
            return
        }

        setIsCreating(true)

        const data: CreateProduto = {
            nome: newNome.trim(),
            codigo: newCodigo.trim(),
            apelido: newApelido.trim() || null,
            subtitulo: newSubtitulo.trim() || null,
            preco,
            custo,
            unidade: newUnidade,
            estoqueMinimo: parseInt(newEstoqueMinimo) || 10,
            ativo: true,
            categoria: newCategoria,
            descricao: newDescricao.trim() || null,
            pesoKg: newPesoKg ? parseFloat(newPesoKg) : null,
            slug: newSlug.trim() || null,
            instrucoesPreparo: newInstrucoesPreparo.trim() || null,
            beneficios: newBeneficios.trim() || null,
            destaque: newDestaque,
            selo: newSelo || null,
            visivelCatalogo: newVisivelCatalogo,
            ehCombo: newEhCombo,
            secaoId: newSecaoId || null,
        } as CreateProduto

        if (newEhCombo && newComponentes.length === 0) {
            toast.error('Um combo precisa de pelo menos um componente')
            setIsCreating(false)
            return
        }

        try {
            const criado = await createProduto(data)
            if (newEhCombo) {
                await produtoService.replaceComponentes(criado.id, newComponentes)
            }
            toast.success('Produto criado!')
            setIsCreateModalOpen(false)
        } catch (e: unknown) {
            console.error(e)
            toast.error(e instanceof Error ? e.message : 'Erro ao criar produto. Tente novamente.')
        } finally {
            setIsCreating(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingProduto) return

        const preco = parseFloat(editPreco)
        // Combo: custo derivado dos componentes; produto simples: custo digitado.
        const custo = editEhCombo ? custoComponentes(editComponentes) : parseFloat(editCusto)

        if (isNaN(preco) || preco <= 0) {
            toast.error('Preço deve ser maior que zero')
            return
        }

        setIsUpdating(true)

        const data: UpdateProduto = {
            nome: editNome.trim(),
            codigo: editCodigo.trim(),
            apelido: editApelido.trim() || null,
            subtitulo: editSubtitulo.trim() || null,
            preco,
            custo,
            estoqueMinimo: parseInt(editEstoqueMinimo) || 10,
            ativo: editAtivo,
            categoria: editCategoria,
            unidade: editUnidade,
            preco_ancoragem: editPrecoAncoragem ? parseFloat(editPrecoAncoragem) : null,
            descricao: editDescricao.trim() || null,
            pesoKg: editPesoKg ? parseFloat(editPesoKg) : null,
            slug: editSlug.trim() || null,
            instrucoesPreparo: editInstrucoesPreparo.trim() || null,
            beneficios: editBeneficios.trim() || null,
            destaque: editDestaque,
            selo: editSelo || null,
            visivelCatalogo: editVisivelCatalogo,
            ehCombo: editEhCombo,
            secaoId: editSecaoId || null,
        } as UpdateProduto

        if (editEhCombo && editComponentes.length === 0) {
            toast.error('Um combo precisa de pelo menos um componente')
            setIsUpdating(false)
            return
        }

        try {
            await updateProduto(editingProduto.id, data)
            // Sincroniza a composição: lista quando combo, vazio (limpa) quando não-combo
            await produtoService.replaceComponentes(editingProduto.id, editEhCombo ? editComponentes : [])
            toast.success('Produto atualizado!')
            handleCloseEdit()
        } catch (e: unknown) {
            console.error(e)
            toast.error(e instanceof Error ? e.message : 'Erro ao atualizar produto. Tente novamente.')
        } finally {
            setIsUpdating(false)
        }
    }

    const handleImageUpload = async (file: File) => {
        setUploadingImage(true)
        try {
            const url = await produtoService.uploadImage(file, editImagemUrl)
            await produtoService.addImageReference(editingProduto!.id, url)
            setEditImagemUrl(url)
            toast.success('Imagem atualizada!')
        } catch (err: unknown) {
            console.error('[Upload] Erro completo:', err)
            const error = err as Error

            if (error?.message?.includes('maximum allowed size')) {
                toast.error('Imagem muito grande. O limite é 5MB. Comprima a imagem e tente novamente.')
            } else if (error?.message?.includes('mime type')) {
                toast.error('Formato não suportado. Use PNG, JPG ou WebP.')
            } else {
                toast.error(`Erro no upload: ${error?.message || 'Tente novamente.'}`)
            }
        } finally {
            setUploadingImage(false)
        }
    }

    const calcularMargem = (preco: number, custo: number): number => {
        if (preco === 0) return 0
        return ((preco - custo) / preco) * 100
    }

    // --- Combo: helpers do picker de componentes ---
    const produtoNome = (id: string) => produtos.find(p => p.id === id)?.nome ?? id

    const getComponenteOptions = (excludeId?: string) => [
        { value: '', label: 'Selecione um produto...' },
        ...produtos
            .filter(p => !p.ehCombo && p.id !== excludeId)
            .map(p => ({ value: p.id, label: p.nome }))
    ]

    const addComponente = (mode: 'create' | 'edit') => {
        if (!pickComponenteId) {
            toast.error('Selecione um produto componente')
            return
        }
        const quantidade = parseFloat(pickQuantidade)
        if (isNaN(quantidade) || quantidade <= 0) {
            toast.error('Quantidade deve ser maior que zero')
            return
        }
        const list = mode === 'create' ? newComponentes : editComponentes
        const setList = mode === 'create' ? setNewComponentes : setEditComponentes
        if (list.some(c => c.componenteId === pickComponenteId)) {
            toast.error('Esse produto já está no combo')
            return
        }
        setList([...list, { componenteId: pickComponenteId, quantidade }])
        setPickComponenteId('')
        setPickQuantidade('1')
    }

    const removeComponente = (mode: 'create' | 'edit', componenteId: string) => {
        if (mode === 'create') {
            setNewComponentes(prev => prev.filter(c => c.componenteId !== componenteId))
        } else {
            setEditComponentes(prev => prev.filter(c => c.componenteId !== componenteId))
        }
    }

    const newCustoEfetivo = newEhCombo ? custoComponentes(newComponentes) : (parseFloat(newCusto) || 0)
    const editCustoEfetivo = editEhCombo ? custoComponentes(editComponentes) : (parseFloat(editCusto) || 0)

    const editMargem = calcularMargem(parseFloat(editPreco) || 0, editCustoEfetivo)
    const newMargem = calcularMargem(parseFloat(newPreco) || 0, newCustoEfetivo)

    return (
        <>
                <Header
                    title="Produtos"
                    showMenu
                    centerTitle
                    onMenuClick={openDrawer}
                    rightAction={
                        <Button variant="ghost" size="icon" onClick={handleOpenCreate}>
                            <Plus className="h-5 w-5" />
                        </Button>
                    }
                />
                <PageContainer className="pt-0 pb-24 bg-transparent px-4">
                    {loading && <PageSkeleton rows={10} showHeader showCards />}

                    {!loading && (
                        <div className="space-y-4">
                            {filterBaixoEstoque && (
                                <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-warning-800">
                                        <AlertTriangle className="h-5 w-5 text-warning-600" />
                                        <span className="font-medium text-sm">
                                            Exibindo {filteredProdutos.length} produtos com baixo estoque
                                        </span>
                                    </div>
                                    <button
                                        onClick={clearFilter}
                                        className="text-xs font-semibold text-warning-700 hover:text-warning-900 flex items-center gap-1 bg-warning-100 hover:bg-warning-200 px-2 py-1 rounded transition-colors"
                                    >
                                        Limpar Filtro
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}

                            {/* KPIs — MOBILE (<lg): intocado (mantém "Baixo Estoque" que o Gilmar usa) */}
                            <div className="grid grid-cols-2 gap-3 lg:hidden">
                                <KpiCard
                                    title="Ativos"
                                    value={produtosAtivos.toString()}
                                    progress={100}
                                    trend="Total"
                                    icon={Package}
                                    variant="compact"
                                />
                                <KpiCard
                                    title="Baixo Estoque"
                                    value={produtosBaixoEstoqueCount.toString()}
                                    progress={produtosAtivos > 0 ? (produtosBaixoEstoqueCount / produtosAtivos) * 100 : 0}
                                    icon={AlertTriangle}
                                    variant="compact"
                                    onClick={() => setSearchParams({ filtro: 'baixo_estoque' })}
                                    className="cursor-pointer"
                                />
                            </div>

                            {/* KPIs — DESKTOP (≥lg): cadastro (estoque vive no /estoque) */}
                            <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
                                <KpiCardDesktop title="Ativos" value={produtosAtivos.toString()} subtitle="Produtos à venda" />
                                <KpiCardDesktop title="Combos" value={combosCount.toString()} subtitle={combosCount > 0 ? 'Montados por componentes' : 'Nenhum combo'} />
                                <KpiCardDesktop title="Fora do catálogo" value={foraCatalogoCount.toString()} subtitle={foraCatalogoCount > 0 ? 'Ativos, ocultos da vitrine' : 'Todos na vitrine'} />
                            </div>

                            {/* Busca — DESKTOP (≥lg): toolbar em linha (mobile não tem busca) */}
                            <div className="hidden lg:flex lg:items-center lg:gap-3">
                                <div className="relative flex-1 lg:max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Buscar produto ou código..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={cn(inputBase, 'h-11 pl-10 pr-4 text-sm')}
                                        aria-label="Buscar produtos"
                                    />
                                </div>
                            </div>

                            {/* MOBILE (<lg): grade de cards — intocada (mobile sagrado) */}
                            <div className="space-y-3 lg:hidden">
                                {filteredProdutos.map((produto) => {
                                    return (
                                        <Card
                                            key={produto.id}
                                            className={cn(
                                                "transition-all cursor-pointer hover:shadow-md border-l-4",
                                                !produto.ativo ? "opacity-60 border-l-gray-300" :
                                                    (produto.estoqueAtual <= produto.estoqueMinimo ? "border-l-warning" : "border-l-success")
                                            )}
                                            onClick={() => handleOpenEdit(produto)}
                                            hover
                                        >
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="h-16 w-16 rounded-lg bg-gray-100 dark:bg-gray-700 shrink-0 overflow-hidden border border-gray-200">
                                                    {produto.imagemUrl ? (
                                                        <img src={produto.imagemUrl} alt={produto.nome} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                                                            <Package className="h-8 w-8" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold truncate">{produto.nome}</h3>
                                                    <div className="text-sm text-gray-500 font-mono">#{produto.codigo}</div>
                                                    <div className="flex gap-4 mt-1">
                                                        <span className="text-sm font-semibold">{formatCurrency(produto.preco)}</span>
                                                        <span className="text-sm text-gray-400">Estoque: {produto.estoqueAtual}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>

                            {/* DESKTOP (≥lg): data grid denso — sort + paginação próprios sobre o conjunto filtrado inteiro */}
                            <div className="hidden lg:block">
                                <ProdutosDataGrid produtos={filteredProdutos} onEdit={handleOpenEdit} />
                            </div>
                        </div>
                    )}

                    {/* Modal de Criação */}
                    <Modal
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        title="Novo Produto"
                        size={isDesktop ? '4xl' : 'lg'}
                    >
                        <div className="space-y-4">
                            <FieldsComponent
                                mode="create"
                                values={{
                                    nome: newNome, codigo: newCodigo, apelido: newApelido, subtitulo: newSubtitulo,
                                    preco: newPreco, custo: newCusto, precoAncoragem: '',
                                    estoqueMinimo: newEstoqueMinimo, ativo: true, categoria: newCategoria,
                                    descricao: newDescricao, pesoKg: newPesoKg, slug: newSlug,
                                    instrucoesPreparo: newInstrucoesPreparo, destaque: newDestaque, selo: newSelo,
                                    visivelCatalogo: newVisivelCatalogo, ehCombo: newEhCombo,
                                    secaoId: newSecaoId, beneficios: newBeneficios,
                                }}
                                setters={{
                                    setNome: setNewNome, setCodigo: setNewCodigo, setApelido: setNewApelido,
                                    setSubtitulo: setNewSubtitulo, setPreco: setNewPreco, setCusto: setNewCusto,
                                    setPrecoAncoragem: () => {}, setEstoqueMinimo: setNewEstoqueMinimo,
                                    setAtivo: () => {}, setCategoria: setNewCategoria, setDescricao: setNewDescricao,
                                    setPesoKg: setNewPesoKg, setSlug: setNewSlug, setInstrucoesPreparo: setNewInstrucoesPreparo,
                                    setDestaque: setNewDestaque, setSelo: setNewSelo, setVisivelCatalogo: setNewVisivelCatalogo, setEhCombo: setNewEhCombo,
                                    setSecaoId: setNewSecaoId, setBeneficios: setNewBeneficios,
                                }}
                                custoEfetivo={newCustoEfetivo}
                                margem={newMargem}
                                showMargem={parseFloat(newPreco) > 0}
                                componentes={newComponentes}
                                componenteOptions={getComponenteOptions()}
                                secaoOptions={secaoOptions}
                                pick={{ componenteId: pickComponenteId, setComponenteId: setPickComponenteId, quantidade: pickQuantidade, setQuantidade: setPickQuantidade }}
                                onAddComponente={() => addComponente('create')}
                                onRemoveComponente={(id) => removeComponente('create', id)}
                                produtoNome={produtoNome}
                            />

                            <ModalActions>
                                <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleCreate}
                                    isLoading={isCreating}
                                    disabled={isCreating}
                                >
                                    Criar Produto
                                </Button>
                            </ModalActions>
                        </div>
                    </Modal>

                    {/* Modal de Edição */}
                    <Modal
                        isOpen={!!editingProduto}
                        onClose={handleCloseEdit}
                        title="Editar Produto"
                        size={isDesktop ? '4xl' : 'lg'}
                    >
                        <div className="space-y-4">
                            <FieldsComponent
                                mode="edit"
                                values={{
                                    nome: editNome, codigo: editCodigo, apelido: editApelido, subtitulo: editSubtitulo,
                                    preco: editPreco, custo: editCusto, precoAncoragem: editPrecoAncoragem,
                                    estoqueMinimo: editEstoqueMinimo, ativo: editAtivo, categoria: editCategoria,
                                    descricao: editDescricao, pesoKg: editPesoKg, slug: editSlug,
                                    instrucoesPreparo: editInstrucoesPreparo, destaque: editDestaque, selo: editSelo,
                                    visivelCatalogo: editVisivelCatalogo, ehCombo: editEhCombo,
                                    secaoId: editSecaoId, beneficios: editBeneficios,
                                }}
                                setters={{
                                    setNome: setEditNome, setCodigo: setEditCodigo, setApelido: setEditApelido,
                                    setSubtitulo: setEditSubtitulo, setPreco: setEditPreco, setCusto: setEditCusto,
                                    setPrecoAncoragem: setEditPrecoAncoragem, setEstoqueMinimo: setEditEstoqueMinimo,
                                    setAtivo: setEditAtivo, setCategoria: setEditCategoria, setDescricao: setEditDescricao,
                                    setPesoKg: setEditPesoKg, setSlug: setEditSlug, setInstrucoesPreparo: setEditInstrucoesPreparo,
                                    setDestaque: setEditDestaque, setSelo: setEditSelo, setVisivelCatalogo: setEditVisivelCatalogo, setEhCombo: setEditEhCombo,
                                    setSecaoId: setEditSecaoId, setBeneficios: setEditBeneficios,
                                }}
                                custoEfetivo={editCustoEfetivo}
                                margem={editMargem}
                                showMargem
                                componentes={editComponentes}
                                componenteOptions={getComponenteOptions(editingProduto?.id)}
                                secaoOptions={secaoOptions}
                                pick={{ componenteId: pickComponenteId, setComponenteId: setPickComponenteId, quantidade: pickQuantidade, setQuantidade: setPickQuantidade }}
                                onAddComponente={() => addComponente('edit')}
                                onRemoveComponente={(id) => removeComponente('edit', id)}
                                produtoNome={produtoNome}
                                imageSlot={
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Imagem do Produto
                                        </label>
                                        {editImagemUrl && (
                                            <div className="relative inline-block">
                                                <img src={editImagemUrl}
                                                    className="w-20 h-20 object-cover rounded-lg mb-2" alt="Imagem do produto" />
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Remover imagem do produto?')) return
                                                        try {
                                                            await produtoService.deleteImage(editingProduto!.id, editImagemUrl)
                                                            setEditImagemUrl(null)
                                                            toast.success('Imagem removida com sucesso')
                                                        } catch (err: unknown) {
                                                            console.error('Erro ao excluir:', err)
                                                            toast.error('Erro ao excluir produto')
                                                        }
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md"
                                                    title="Remover imagem"
                                                    aria-label="Remover imagem"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => e.target.files?.[0] &&
                                                handleImageUpload(e.target.files[0])}
                                            disabled={uploadingImage}
                                            className="text-sm"
                                        />
                                        {uploadingImage && <p className="text-xs mt-1">Enviando...</p>}
                                    </div>
                                }
                            />

                            <ModalActions>
                                <Button variant="ghost" onClick={handleCloseEdit}>
                                    Cancelar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleUpdate}
                                    isLoading={isUpdating}
                                    disabled={isUpdating}
                                >
                                    Salvar Alterações
                                </Button>
                            </ModalActions>
                        </div>
                    </Modal>
                </PageContainer>
        </>
    )
}
