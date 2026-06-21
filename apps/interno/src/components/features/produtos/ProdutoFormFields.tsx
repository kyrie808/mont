import { useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button, Input, Select, Badge, Tabs, TabsList, TabsTrigger } from '../../ui'
import { formatCurrency } from '@mont/shared'

// Campos compartilhados pelos modais de Criar e Editar produto. O estado e os handlers
// continuam na página (Produtos.tsx); aqui só fica o JSX (antes duplicado). Cores cruas
// preservadas de propósito — Produtos está fora da campanha de tokenização.
//
// Organizado em 2 abas: "Sistema" (o que é do produto/operação) e "Catálogo" (o que
// aparece/controla a vitrine). Reforça a fronteira interno = fonte única / catálogo só lê.

export interface ProdutoFormValues {
    nome: string
    codigo: string
    apelido: string
    subtitulo: string
    preco: string
    custo: string
    precoAncoragem: string
    estoqueMinimo: string
    ativo: boolean
    categoria: string
    descricao: string
    pesoKg: string
    slug: string
    instrucoesPreparo: string
    beneficios: string
    destaque: boolean
    selo: string
    visivelCatalogo: boolean
    ehCombo: boolean
    secaoId: string
}

export interface ProdutoFormSetters {
    setNome: (v: string) => void
    setCodigo: (v: string) => void
    setApelido: (v: string) => void
    setSubtitulo: (v: string) => void
    setPreco: (v: string) => void
    setCusto: (v: string) => void
    setPrecoAncoragem: (v: string) => void
    setEstoqueMinimo: (v: string) => void
    setAtivo: (v: boolean) => void
    setCategoria: (v: string) => void
    setDescricao: (v: string) => void
    setPesoKg: (v: string) => void
    setSlug: (v: string) => void
    setInstrucoesPreparo: (v: string) => void
    setBeneficios: (v: string) => void
    setDestaque: (v: boolean) => void
    setSelo: (v: string) => void
    setVisivelCatalogo: (v: boolean) => void
    setEhCombo: (v: boolean) => void
    setSecaoId: (v: string) => void
}

interface ComboPicker {
    componenteId: string
    setComponenteId: (v: string) => void
    quantidade: string
    setQuantidade: (v: string) => void
}

interface ProdutoFormFieldsProps {
    mode: 'create' | 'edit'
    values: ProdutoFormValues
    setters: ProdutoFormSetters
    custoEfetivo: number
    margem: number
    showMargem: boolean
    componentes: { componenteId: string; quantidade: number }[]
    componenteOptions: { value: string; label: string }[]
    secaoOptions: { value: string; label: string }[]
    pick: ComboPicker
    onAddComponente: () => void
    onRemoveComponente: (componenteId: string) => void
    produtoNome: (id: string) => string
    /** Bloco de imagem (só no modo edit). */
    imageSlot?: ReactNode
}

const CATEGORIA_OPTIONS = [
    { value: '', label: 'Selecione...' },
    { value: 'congelado', label: 'Congelado' },
    { value: 'refrigerado', label: 'Refrigerado' },
    { value: 'cervejas', label: 'Cervejas' },
    { value: 'refrigerantes', label: 'Refrigerantes' },
    { value: 'combo', label: 'Combo' },
]

// Selo (badge) do card do catálogo. Independente de "Destaque (carrossel)".
const SELO_OPTIONS = [
    { value: '', label: 'Nenhum' },
    { value: 'mais_vendido', label: 'Mais vendido' },
    { value: 'oferta', label: 'Oferta' },
    { value: 'queridinho', label: 'Queridinho' },
]

const SUBTITULO_SUGESTOES = ['25gr por unidade', '50gr por unidade', '75gr por unidade', '100gr por unidade', '1 baldinho', '1 balde', 'combo']

const inputCru = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-transparent'

export function ProdutoFormFields({
    mode,
    values,
    setters,
    custoEfetivo,
    margem,
    showMargem,
    componentes,
    componenteOptions,
    secaoOptions,
    pick,
    onAddComponente,
    onRemoveComponente,
    produtoNome,
    imageSlot,
}: ProdutoFormFieldsProps) {
    const isEdit = mode === 'edit'
    const datalistId = `variacoes-sugestoes-${mode}`
    const [aba, setAba] = useState<'sistema' | 'catalogo'>('sistema')

    return (
        <div className="space-y-4">
            <Tabs value={aba} onValueChange={(v) => setAba(v as 'sistema' | 'catalogo')}>
                <TabsList>
                    <TabsTrigger value="sistema">Sistema</TabsTrigger>
                    <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
                </TabsList>
            </Tabs>

            {/* ───────────── ABA SISTEMA ───────────── */}
            {aba === 'sistema' && (
                <div className="space-y-4">
                    <Input
                        label="Nome do Produto"
                        value={values.nome}
                        onChange={(e) => setters.setNome(e.target.value)}
                        placeholder={isEdit ? undefined : 'Ex: Pão de Queijo 1kg'}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Código"
                            value={values.codigo}
                            onChange={(e) => setters.setCodigo(e.target.value)}
                            placeholder={isEdit ? undefined : 'Ex: PQ001'}
                            required
                        />
                        <Input
                            label="Apelido"
                            value={values.apelido}
                            onChange={(e) => setters.setApelido(e.target.value)}
                            placeholder={isEdit ? undefined : 'Nome curto'}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Preço de Venda"
                            type="number"
                            value={values.preco}
                            onChange={(e) => setters.setPreco(e.target.value)}
                            placeholder={isEdit ? undefined : '0.00'}
                        />
                        <Input
                            label={values.ehCombo ? 'Custo (soma dos componentes)' : 'Custo'}
                            type={values.ehCombo ? 'text' : 'number'}
                            value={values.ehCombo ? formatCurrency(custoEfetivo) : values.custo}
                            onChange={(e) => setters.setCusto(e.target.value)}
                            disabled={values.ehCombo}
                            placeholder={isEdit ? undefined : '0.00'}
                        />
                    </div>

                    {showMargem && (
                        <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-lg flex justify-between items-center">
                            <span className="text-sm text-gray-500">Margem Estimada</span>
                            <Badge variant={margem > 30 ? 'success' : margem > 15 ? 'warning' : 'destructive'}>
                                {margem.toFixed(1)}%
                            </Badge>
                        </div>
                    )}

                    {isEdit ? (
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Estoque Mínimo"
                                type="number"
                                value={values.estoqueMinimo}
                                onChange={(e) => setters.setEstoqueMinimo(e.target.value)}
                            />
                            <Select
                                label="Status"
                                value={values.ativo ? 'true' : 'false'}
                                onChange={(e) => setters.setAtivo(e.target.value === 'true')}
                                options={[
                                    { label: 'Ativo', value: 'true' },
                                    { label: 'Inativo', value: 'false' },
                                ]}
                            />
                        </div>
                    ) : (
                        <Input
                            label="Estoque Mínimo"
                            type="number"
                            value={values.estoqueMinimo}
                            onChange={(e) => setters.setEstoqueMinimo(e.target.value)}
                        />
                    )}

                    {/* Kit / Combo */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                        <Select
                            label="É um kit/combo?"
                            value={values.ehCombo ? 'true' : 'false'}
                            onChange={(e) => setters.setEhCombo(e.target.value === 'true')}
                            options={[
                                { label: 'Não — produto simples', value: 'false' },
                                { label: 'Sim — combo de vários produtos', value: 'true' },
                            ]}
                        />
                        {values.ehCombo && (
                            <div className="space-y-2">
                                <p className="text-xs text-gray-500">Vendido como uma unidade ao preço acima. Liste os produtos que compõem o kit.</p>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Select
                                            label="Componente"
                                            value={pick.componenteId}
                                            onChange={(e) => pick.setComponenteId(e.target.value)}
                                            options={componenteOptions}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <Input
                                            label="Qtd"
                                            type="number"
                                            value={pick.quantidade}
                                            onChange={(e) => pick.setQuantidade(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="secondary" type="button" onClick={onAddComponente}>
                                        Adicionar
                                    </Button>
                                </div>
                                {componentes.length > 0 && (
                                    <ul className="space-y-1">
                                        {componentes.map((c) => (
                                            <li key={c.componenteId} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded px-3 py-2 text-sm">
                                                <span>{produtoNome(c.componenteId)} × {c.quantidade}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveComponente(c.componenteId)}
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
                </div>
            )}

            {/* ───────────── ABA CATÁLOGO ───────────── */}
            {aba === 'catalogo' && (
                <div className="space-y-4">
                    <Select
                        label="Categoria (etiqueta de temperatura)"
                        value={values.categoria}
                        onChange={(e) => setters.setCategoria(e.target.value)}
                        options={CATEGORIA_OPTIONS}
                    />

                    <div>
                        <label htmlFor={`${mode}-subtitulo`} className="block text-sm font-medium mb-1">Variação / Subtítulo</label>
                        <input
                            id={`${mode}-subtitulo`}
                            type="text"
                            list={datalistId}
                            placeholder="Ex: 75gr por unidade, 1 balde, combo"
                            value={values.subtitulo}
                            onChange={(e) => setters.setSubtitulo(e.target.value)}
                            className={inputCru}
                        />
                        <datalist id={datalistId}>
                            {SUBTITULO_SUGESTOES.map((s) => <option key={s} value={s} />)}
                        </datalist>
                        <p className="text-xs text-gray-400 mt-1">Aparece abaixo do nome do produto no catálogo</p>
                    </div>

                    <Input
                        label="Preço de Ancoragem (riscado)"
                        type="number"
                        value={values.precoAncoragem}
                        onChange={(e) => setters.setPrecoAncoragem(e.target.value)}
                        placeholder="Opcional"
                    />

                    <div>
                        <label htmlFor={`${mode}-descricao`} className="block text-sm font-medium mb-1">Descrição</label>
                        <textarea
                            id={`${mode}-descricao`}
                            rows={3}
                            value={values.descricao}
                            onChange={(e) => setters.setDescricao(e.target.value)}
                            placeholder="Descrição que aparece na página do produto"
                            className={inputCru}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Peso (kg)"
                            type="number"
                            value={values.pesoKg}
                            onChange={(e) => setters.setPesoKg(e.target.value)}
                            placeholder="Ex: 1"
                        />
                        <Input
                            label="Slug (URL)"
                            value={values.slug}
                            onChange={(e) => setters.setSlug(e.target.value)}
                            placeholder="ex: pao-queijo-1kg"
                        />
                    </div>

                    <div>
                        <label htmlFor={`${mode}-instrucoes`} className="block text-sm font-medium mb-1">Instruções de preparo</label>
                        <textarea
                            id={`${mode}-instrucoes`}
                            rows={3}
                            value={values.instrucoesPreparo}
                            onChange={(e) => setters.setInstrucoesPreparo(e.target.value)}
                            placeholder="Uma instrução por linha"
                            className={inputCru}
                        />
                    </div>

                    <div>
                        <label htmlFor={`${mode}-beneficios`} className="block text-sm font-medium mb-1">Checklist do card de destaque (um por linha)</label>
                        <textarea
                            id={`${mode}-beneficios`}
                            rows={3}
                            value={values.beneficios}
                            onChange={(e) => setters.setBeneficios(e.target.value)}
                            placeholder={'Artesanal\nSem conservante\nQueijo Canastra de verdade'}
                            className={inputCru}
                        />
                        <p className="text-xs text-gray-400 mt-1">Aparece nos slides do carrossel (produtos não-combo). Vazio = usa os selos padrão da Mont.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Visível no catálogo"
                            value={values.visivelCatalogo ? 'true' : 'false'}
                            onChange={(e) => setters.setVisivelCatalogo(e.target.value === 'true')}
                            options={[
                                { label: 'Sim', value: 'true' },
                                { label: 'Não', value: 'false' },
                            ]}
                        />
                        <Select
                            label="Destaque (carrossel)"
                            value={values.destaque ? 'true' : 'false'}
                            onChange={(e) => setters.setDestaque(e.target.value === 'true')}
                            options={[
                                { label: 'Sim', value: 'true' },
                                { label: 'Não', value: 'false' },
                            ]}
                        />
                    </div>

                    <Select
                        label="Selo (badge do card)"
                        value={values.selo}
                        onChange={(e) => setters.setSelo(e.target.value)}
                        options={SELO_OPTIONS}
                    />

                    <Select
                        label="Seção da vitrine (aba do catálogo)"
                        value={values.secaoId}
                        onChange={(e) => setters.setSecaoId(e.target.value)}
                        options={[{ label: 'Nenhuma', value: '' }, ...secaoOptions]}
                    />

                    {imageSlot}
                </div>
            )}
        </div>
    )
}
