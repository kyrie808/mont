import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigationStore } from '@/stores/useNavigationStore'
import {
    Package,
    Plus,
    AlertTriangle,
    X
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { Card, PageSkeleton, Modal, ModalActions, Button, Input, Select, Badge } from '../components/ui'
import { KpiCard } from '../components/dashboard/KpiCard'
import { cn } from '@mont/shared'
import { useProdutos } from '../hooks/useProdutos'
import { useToast } from '../components/ui/Toast'
import { formatCurrency } from '@mont/shared'
import { produtoService } from '../services/produtoService'
import type { DomainProduto, CreateProduto, UpdateProduto } from '../types/domain'


export function Produtos() {
    const { openDrawer } = useNavigationStore()
    const toast = useToast()
    const [searchParams, setSearchParams] = useSearchParams()
    const { produtos, loading, createProduto, updateProduto } = useProdutos(true)

    // Filters
    const filterBaixoEstoque = searchParams.get('filtro') === 'baixo_estoque'

    const filteredProdutos = useMemo(() => {
        if (!filterBaixoEstoque) return produtos

        return produtos.filter(p => {
            const atual = p.estoqueAtual || 0
            const minimo = p.estoqueMinimo || 10
            return atual <= minimo && p.ativo
        })
    }, [produtos, filterBaixoEstoque])

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
    const [newDestaque, setNewDestaque] = useState(false)
    const [newVisivelCatalogo, setNewVisivelCatalogo] = useState(true)
    const [newEhCombo, setNewEhCombo] = useState(false)
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
    const [editDestaque, setEditDestaque] = useState(false)
    const [editVisivelCatalogo, setEditVisivelCatalogo] = useState(true)
    const [editEhCombo, setEditEhCombo] = useState(false)
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
        setEditDestaque(produto.destaque ?? false)
        setEditVisivelCatalogo(produto.visivelCatalogo ?? true)
        setEditEhCombo(produto.ehCombo ?? false)
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
        setNewDestaque(false)
        setNewVisivelCatalogo(true)
        setNewEhCombo(false)
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
        const custo = parseFloat(newCusto)

        if (isNaN(preco) || preco <= 0) {
            toast.error('Preço deve ser maior que zero')
            return
        }

        if (isNaN(custo) || custo <= 0) {
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
            destaque: newDestaque,
            visivelCatalogo: newVisivelCatalogo,
            ehCombo: newEhCombo,
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
        const custo = parseFloat(editCusto)

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
            destaque: editDestaque,
            visivelCatalogo: editVisivelCatalogo,
            ehCombo: editEhCombo,
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

    const editMargem = calcularMargem(parseFloat(editPreco) || 0, parseFloat(editCusto) || 0)
    const newMargem = calcularMargem(parseFloat(newPreco) || 0, parseFloat(newCusto) || 0)

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

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

                            <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
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
                        </div>
                    )}

                    {/* Modal de Criação */}
                    <Modal
                        isOpen={isCreateModalOpen}
                        onClose={() => setIsCreateModalOpen(false)}
                        title="Novo Produto"
                        size="lg"
                    >
                        <div className="space-y-4">
                            <Input
                                label="Nome do Produto"
                                value={newNome}
                                onChange={(e) => setNewNome(e.target.value)}
                                placeholder="Ex: Pão de Queijo 1kg"
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Código"
                                    value={newCodigo}
                                    onChange={(e) => setNewCodigo(e.target.value)}
                                    placeholder="Ex: PQ001"
                                    required
                                />
                                <Input
                                    label="Apelido"
                                    value={newApelido}
                                    onChange={(e) => setNewApelido(e.target.value)}
                                    placeholder="Nome curto"
                                />
                            </div>
                            <div>
                                <label htmlFor="new-subtitulo" className="block text-sm font-medium mb-1">Variação / Subtítulo</label>
                                <input
                                    id="new-subtitulo"
                                    type="text"
                                    list="variacoes-sugestoes"
                                    placeholder="Ex: 75gr por unidade, 1 balde, combo"
                                    value={newSubtitulo}
                                    onChange={(e) => setNewSubtitulo(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                                <datalist id="variacoes-sugestoes">
                                    <option value="25gr por unidade" />
                                    <option value="50gr por unidade" />
                                    <option value="75gr por unidade" />
                                    <option value="100gr por unidade" />
                                    <option value="1 baldinho" />
                                    <option value="1 balde" />
                                    <option value="combo" />
                                </datalist>
                                <p className="text-xs text-gray-400 mt-1">Aparece abaixo do nome do produto no catálogo</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Preço de Venda"
                                    type="number"
                                    value={newPreco}
                                    onChange={(e) => setNewPreco(e.target.value)}
                                    placeholder="0.00"
                                />
                                <Input
                                    label="Custo"
                                    type="number"
                                    value={newCusto}
                                    onChange={(e) => setNewCusto(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>

                            {/* Margem Preview */}
                            {(parseFloat(newPreco) > 0) && (
                                <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg flex justify-between items-center transition-all animate-in fade-in slide-in-from-left-2">
                                    <span className="text-sm text-gray-500">Margem Estimada</span>
                                    <Badge variant={newMargem > 30 ? 'success' : newMargem > 15 ? 'warning' : 'destructive'}>
                                        {newMargem.toFixed(1)}%
                                    </Badge>
                                </div>
                            )}

                            <Input
                                label="Estoque Mínimo"
                                type="number"
                                value={newEstoqueMinimo}
                                onChange={(e) => setNewEstoqueMinimo(e.target.value)}
                            />

                            <Select
                                label="Categoria"
                                value={newCategoria}
                                onChange={e => setNewCategoria(e.target.value)}
                                options={[
                                    { value: '', label: 'Selecione...' },
                                    { value: 'congelado', label: 'Congelado' },
                                    { value: 'refrigerado', label: 'Refrigerado' },
                                    { value: 'cervejas', label: 'Cervejas' },
                                    { value: 'refrigerantes', label: 'Refrigerantes' },
                                    { value: 'combo', label: 'Combo' }
                                ]}
                            />

                            {/* Apresentação no catálogo — fonte única no interno */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Apresentação no catálogo</p>
                                <div>
                                    <label htmlFor="new-descricao" className="block text-sm font-medium mb-1">Descrição</label>
                                    <textarea
                                        id="new-descricao"
                                        rows={3}
                                        value={newDescricao}
                                        onChange={(e) => setNewDescricao(e.target.value)}
                                        placeholder="Descrição que aparece na página do produto"
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Peso (kg)"
                                        type="number"
                                        value={newPesoKg}
                                        onChange={(e) => setNewPesoKg(e.target.value)}
                                        placeholder="Ex: 1"
                                    />
                                    <Input
                                        label="Slug (URL)"
                                        value={newSlug}
                                        onChange={(e) => setNewSlug(e.target.value)}
                                        placeholder="ex: pao-queijo-1kg"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="new-instrucoes" className="block text-sm font-medium mb-1">Instruções de preparo</label>
                                    <textarea
                                        id="new-instrucoes"
                                        rows={3}
                                        value={newInstrucoesPreparo}
                                        onChange={(e) => setNewInstrucoesPreparo(e.target.value)}
                                        placeholder="Uma instrução por linha"
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Visível no catálogo"
                                        value={newVisivelCatalogo ? 'true' : 'false'}
                                        onChange={(e) => setNewVisivelCatalogo(e.target.value === 'true')}
                                        options={[
                                            { label: 'Sim', value: 'true' },
                                            { label: 'Não', value: 'false' },
                                        ]}
                                    />
                                    <Select
                                        label="Destaque"
                                        value={newDestaque ? 'true' : 'false'}
                                        onChange={(e) => setNewDestaque(e.target.value === 'true')}
                                        options={[
                                            { label: 'Sim', value: 'true' },
                                            { label: 'Não', value: 'false' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Kit / Combo */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                                <Select
                                    label="É um kit/combo?"
                                    value={newEhCombo ? 'true' : 'false'}
                                    onChange={(e) => setNewEhCombo(e.target.value === 'true')}
                                    options={[
                                        { label: 'Não — produto simples', value: 'false' },
                                        { label: 'Sim — combo de vários produtos', value: 'true' },
                                    ]}
                                />
                                {newEhCombo && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">Vendido como uma unidade ao preço acima. Liste os produtos que compõem o kit.</p>
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <Select
                                                    label="Componente"
                                                    value={pickComponenteId}
                                                    onChange={(e) => setPickComponenteId(e.target.value)}
                                                    options={getComponenteOptions()}
                                                />
                                            </div>
                                            <div className="w-20">
                                                <Input
                                                    label="Qtd"
                                                    type="number"
                                                    value={pickQuantidade}
                                                    onChange={(e) => setPickQuantidade(e.target.value)}
                                                />
                                            </div>
                                            <Button variant="secondary" type="button" onClick={() => addComponente('create')}>
                                                Adicionar
                                            </Button>
                                        </div>
                                        {newComponentes.length > 0 && (
                                            <ul className="space-y-1">
                                                {newComponentes.map((c) => (
                                                    <li key={c.componenteId} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded px-3 py-2 text-sm">
                                                        <span>{produtoNome(c.componenteId)} × {c.quantidade}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeComponente('create', c.componenteId)}
                                                            className="text-red-500 hover:text-red-600"
                                                            aria-label="Remover componente"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

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
                        size="lg"
                    >
                        <div className="space-y-4">
                            <Input
                                label="Nome do Produto"
                                value={editNome}
                                onChange={(e) => setEditNome(e.target.value)}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Código"
                                    value={editCodigo}
                                    onChange={(e) => setEditCodigo(e.target.value)}
                                    required
                                />
                                <Input
                                    label="Apelido"
                                    value={editApelido}
                                    onChange={(e) => setEditApelido(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="edit-subtitulo" className="block text-sm font-medium mb-1">Variação / Subtítulo</label>
                                <input
                                    id="edit-subtitulo"
                                    type="text"
                                    list="variacoes-sugestoes-edit"
                                    placeholder="Ex: 75gr por unidade, 1 balde, combo"
                                    value={editSubtitulo}
                                    onChange={(e) => setEditSubtitulo(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                                <datalist id="variacoes-sugestoes-edit">
                                    <option value="25gr por unidade" />
                                    <option value="50gr por unidade" />
                                    <option value="75gr por unidade" />
                                    <option value="100gr por unidade" />
                                    <option value="1 baldinho" />
                                    <option value="1 balde" />
                                    <option value="combo" />
                                </datalist>
                                <p className="text-xs text-gray-400 mt-1">Aparece abaixo do nome do produto no catálogo</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Preço de Venda"
                                    type="number"
                                    value={editPreco}
                                    onChange={(e) => setEditPreco(e.target.value)}
                                />
                                <Input
                                    label="Preço de Ancoragem (riscado)"
                                    type="number"
                                    value={editPrecoAncoragem}
                                    onChange={(e) => setEditPrecoAncoragem(e.target.value)}
                                    placeholder="Opcional"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Custo"
                                    type="number"
                                    value={editCusto}
                                    onChange={(e) => setEditCusto(e.target.value)}
                                />
                            </div>

                            {/* Margem Preview */}
                            <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-sm text-gray-500">Margem Estimada</span>
                                <Badge variant={editMargem > 30 ? 'success' : editMargem > 15 ? 'warning' : 'destructive'}>
                                    {editMargem.toFixed(1)}%
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Estoque Mínimo"
                                    type="number"
                                    value={editEstoqueMinimo}
                                    onChange={(e) => setEditEstoqueMinimo(e.target.value)}
                                />
                                <Select
                                    label="Status"
                                    value={editAtivo ? 'true' : 'false'}
                                    onChange={(e) => setEditAtivo(e.target.value === 'true')}
                                    options={[
                                        { label: 'Ativo', value: 'true' },
                                        { label: 'Inativo', value: 'false' },
                                    ]}
                                />
                            </div>


                            <Select
                                label="Categoria"
                                value={editCategoria}
                                onChange={e => setEditCategoria(e.target.value)}
                                options={[
                                    { value: '', label: 'Selecione...' },
                                    { value: 'congelado', label: 'Congelado' },
                                    { value: 'refrigerado', label: 'Refrigerado' },
                                    { value: 'cervejas', label: 'Cervejas' },
                                    { value: 'refrigerantes', label: 'Refrigerantes' },
                                    { value: 'combo', label: 'Combo' }
                                ]}
                            />

                            {/* Apresentação no catálogo — fonte única no interno */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Apresentação no catálogo</p>
                                <div>
                                    <label htmlFor="edit-descricao" className="block text-sm font-medium mb-1">Descrição</label>
                                    <textarea
                                        id="edit-descricao"
                                        rows={3}
                                        value={editDescricao}
                                        onChange={(e) => setEditDescricao(e.target.value)}
                                        placeholder="Descrição que aparece na página do produto"
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Peso (kg)"
                                        type="number"
                                        value={editPesoKg}
                                        onChange={(e) => setEditPesoKg(e.target.value)}
                                        placeholder="Ex: 1"
                                    />
                                    <Input
                                        label="Slug (URL)"
                                        value={editSlug}
                                        onChange={(e) => setEditSlug(e.target.value)}
                                        placeholder="ex: pao-queijo-1kg"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-instrucoes" className="block text-sm font-medium mb-1">Instruções de preparo</label>
                                    <textarea
                                        id="edit-instrucoes"
                                        rows={3}
                                        value={editInstrucoesPreparo}
                                        onChange={(e) => setEditInstrucoesPreparo(e.target.value)}
                                        placeholder="Uma instrução por linha"
                                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Visível no catálogo"
                                        value={editVisivelCatalogo ? 'true' : 'false'}
                                        onChange={(e) => setEditVisivelCatalogo(e.target.value === 'true')}
                                        options={[
                                            { label: 'Sim', value: 'true' },
                                            { label: 'Não', value: 'false' },
                                        ]}
                                    />
                                    <Select
                                        label="Destaque"
                                        value={editDestaque ? 'true' : 'false'}
                                        onChange={(e) => setEditDestaque(e.target.value === 'true')}
                                        options={[
                                            { label: 'Sim', value: 'true' },
                                            { label: 'Não', value: 'false' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {/* Kit / Combo */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                                <Select
                                    label="É um kit/combo?"
                                    value={editEhCombo ? 'true' : 'false'}
                                    onChange={(e) => setEditEhCombo(e.target.value === 'true')}
                                    options={[
                                        { label: 'Não — produto simples', value: 'false' },
                                        { label: 'Sim — combo de vários produtos', value: 'true' },
                                    ]}
                                />
                                {editEhCombo && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">Vendido como uma unidade ao preço acima. Liste os produtos que compõem o kit.</p>
                                        <div className="flex gap-2 items-end">
                                            <div className="flex-1">
                                                <Select
                                                    label="Componente"
                                                    value={pickComponenteId}
                                                    onChange={(e) => setPickComponenteId(e.target.value)}
                                                    options={getComponenteOptions(editingProduto?.id)}
                                                />
                                            </div>
                                            <div className="w-20">
                                                <Input
                                                    label="Qtd"
                                                    type="number"
                                                    value={pickQuantidade}
                                                    onChange={(e) => setPickQuantidade(e.target.value)}
                                                />
                                            </div>
                                            <Button variant="secondary" type="button" onClick={() => addComponente('edit')}>
                                                Adicionar
                                            </Button>
                                        </div>
                                        {editComponentes.length > 0 && (
                                            <ul className="space-y-1">
                                                {editComponentes.map((c) => (
                                                    <li key={c.componenteId} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded px-3 py-2 text-sm">
                                                        <span>{produtoNome(c.componenteId)} × {c.quantidade}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeComponente('edit', c.componenteId)}
                                                            className="text-red-500 hover:text-red-600"
                                                            aria-label="Remover componente"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

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
