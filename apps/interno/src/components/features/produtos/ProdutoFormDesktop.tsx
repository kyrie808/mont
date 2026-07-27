import { useState, type ReactNode } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { Button, Badge, Tabs, TabsList, TabsTrigger } from '../../ui'
import { cn, formatCurrency } from '@mont/shared'
import type { ProdutoFormValues, ProdutoFormSetters } from './ProdutoFormFields'

// Versão DESKTOP (≥lg) do formulário de produto — tokenizada e DENSA (grid de 4 colunas)
// pra caber em ~85vh SEM scroll. Mesma interface de props do ProdutoFormFields (mobile,
// cores cruas, sagrado): estado e handlers seguem em Produtos.tsx. Padrão v2 do ContatoFormDesktop.

const inputBase =
    'flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background ' +
    'placeholder:text-muted-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const fieldH = 'h-10 px-3 py-2 text-sm'
const selectCls = cn(inputBase, fieldH, 'appearance-none pr-9')
const textareaCls = cn(inputBase, 'px-3 py-2 text-sm resize-none')
const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1 truncate'

const CATEGORIA_OPTIONS = [
    { value: '', label: 'Selecione...' },
    { value: 'congelado', label: 'Congelado' },
    { value: 'refrigerado', label: 'Refrigerado' },
    { value: 'cervejas', label: 'Cervejas' },
    { value: 'refrigerantes', label: 'Refrigerantes' },
    { value: 'combo', label: 'Combo' },
]
const SELO_OPTIONS = [
    { value: '', label: 'Nenhum' },
    { value: 'mais_vendido', label: 'Mais vendido' },
    { value: 'oferta', label: 'Oferta' },
    { value: 'queridinho', label: 'Queridinho' },
]
const SUBTITULO_SUGESTOES = ['25gr por unidade', '50gr por unidade', '75gr por unidade', '100gr por unidade', '1 baldinho', '1 balde', 'combo']

function Field({ label, required, className, children }: {
    label: string; required?: boolean; className?: string; children: ReactNode
}) {
    return (
        <div className={className}>
            <label className={labelCls} title={label}>
                {label}{required && <span className="text-destructive"> *</span>}
            </label>
            {children}
        </div>
    )
}

function SelectWrap({ children }: { children: ReactNode }) {
    return (
        <div className="relative">
            {children}
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    )
}

interface Props {
    mode: 'create' | 'edit'
    values: ProdutoFormValues
    setters: ProdutoFormSetters
    custoEfetivo: number
    margem: number
    showMargem: boolean
    componentes: { componenteId: string; quantidade: number }[]
    componenteOptions: { value: string; label: string }[]
    secaoOptions: { value: string; label: string }[]
    pick: { componenteId: string; setComponenteId: (v: string) => void; quantidade: string; setQuantidade: (v: string) => void }
    onAddComponente: () => void
    onRemoveComponente: (componenteId: string) => void
    produtoNome: (id: string) => string
    imageSlot?: ReactNode
}

export function ProdutoFormDesktop({
    mode, values, setters, custoEfetivo, margem, showMargem,
    componentes, componenteOptions, secaoOptions, pick,
    onAddComponente, onRemoveComponente, produtoNome, imageSlot,
}: Props) {
    const isEdit = mode === 'edit'
    const datalistId = `variacoes-sugestoes-desktop-${mode}`
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
                <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                    <Field label="Nome do produto" required className="col-span-2">
                        <input
                            autoFocus
                            value={values.nome}
                            onChange={(e) => setters.setNome(e.target.value)}
                            className={cn(inputBase, fieldH, 'font-medium')}
                            placeholder={isEdit ? undefined : 'Ex: Pão de Queijo 1kg'}
                        />
                    </Field>
                    <Field label="Código" required>
                        <input
                            value={values.codigo}
                            onChange={(e) => setters.setCodigo(e.target.value)}
                            className={cn(inputBase, fieldH, 'font-mono')}
                            placeholder={isEdit ? undefined : 'PQ001'}
                        />
                    </Field>
                    <Field label="Apelido">
                        <input
                            value={values.apelido}
                            onChange={(e) => setters.setApelido(e.target.value)}
                            className={cn(inputBase, fieldH)}
                            placeholder={isEdit ? undefined : 'Curto'}
                        />
                    </Field>

                    <Field label="Preço de venda">
                        <input
                            type="number"
                            value={values.preco}
                            onChange={(e) => setters.setPreco(e.target.value)}
                            className={cn(inputBase, fieldH, 'tabular-nums')}
                            placeholder={isEdit ? undefined : '0.00'}
                        />
                    </Field>
                    <Field label={values.ehCombo ? 'Custo (componentes)' : 'Custo'}>
                        <input
                            type={values.ehCombo ? 'text' : 'number'}
                            value={values.ehCombo ? formatCurrency(custoEfetivo) : values.custo}
                            onChange={(e) => setters.setCusto(e.target.value)}
                            disabled={values.ehCombo}
                            className={cn(inputBase, fieldH, 'tabular-nums')}
                            placeholder={isEdit ? undefined : '0.00'}
                        />
                    </Field>
                    <Field label="Estoque mínimo">
                        <input
                            type="number"
                            value={values.estoqueMinimo}
                            onChange={(e) => setters.setEstoqueMinimo(e.target.value)}
                            className={cn(inputBase, fieldH, 'tabular-nums')}
                        />
                    </Field>
                    {isEdit && (
                        <Field label="Status">
                            <SelectWrap>
                                <select
                                    value={values.ativo ? 'true' : 'false'}
                                    onChange={(e) => setters.setAtivo(e.target.value === 'true')}
                                    className={selectCls}
                                >
                                    <option value="true">Ativo</option>
                                    <option value="false">Inativo</option>
                                </select>
                            </SelectWrap>
                        </Field>
                    )}

                    {showMargem && (
                        <div className="col-span-2 flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-2">
                            <span className="text-sm text-muted-foreground">Margem estimada</span>
                            <Badge variant={margem > 30 ? 'success' : margem > 15 ? 'warning' : 'destructive'}>
                                {margem.toFixed(1)}%
                            </Badge>
                        </div>
                    )}
                    <Field label="É um kit/combo?" className="col-span-2">
                        <SelectWrap>
                            <select
                                value={values.ehCombo ? 'true' : 'false'}
                                onChange={(e) => setters.setEhCombo(e.target.value === 'true')}
                                className={selectCls}
                            >
                                <option value="false">Não — produto simples</option>
                                <option value="true">Sim — combo de vários produtos</option>
                            </select>
                        </SelectWrap>
                    </Field>

                    {values.ehCombo && (
                        <div className="col-span-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                            <div className="flex items-end gap-2">
                                <Field label="Componente" className="flex-1">
                                    <SelectWrap>
                                        <select
                                            value={pick.componenteId}
                                            onChange={(e) => pick.setComponenteId(e.target.value)}
                                            className={selectCls}
                                        >
                                            {componenteOptions.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrap>
                                </Field>
                                <Field label="Qtd" className="w-20">
                                    <input
                                        type="number"
                                        value={pick.quantidade}
                                        onChange={(e) => pick.setQuantidade(e.target.value)}
                                        className={cn(inputBase, fieldH, 'tabular-nums')}
                                    />
                                </Field>
                                <Button variant="secondary" type="button" onClick={onAddComponente} className="h-10">
                                    Adicionar
                                </Button>
                            </div>
                            {componentes.length > 0 && (
                                <ul className="grid grid-cols-2 gap-1.5">
                                    {componentes.map((c) => (
                                        <li key={c.componenteId} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                                            <span className="truncate text-foreground">{produtoNome(c.componenteId)} × {c.quantidade}</span>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveComponente(c.componenteId)}
                                                className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10"
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
            )}

            {/* ───────────── ABA CATÁLOGO ───────────── */}
            {aba === 'catalogo' && (
                <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                    <Field label="Categoria">
                        <SelectWrap>
                            <select
                                value={values.categoria}
                                onChange={(e) => setters.setCategoria(e.target.value)}
                                className={selectCls}
                            >
                                {CATEGORIA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </SelectWrap>
                    </Field>
                    <Field label="Ancoragem (riscado)">
                        <input
                            type="number"
                            value={values.precoAncoragem}
                            onChange={(e) => setters.setPrecoAncoragem(e.target.value)}
                            className={cn(inputBase, fieldH, 'tabular-nums')}
                            placeholder="Opcional"
                        />
                    </Field>
                    <Field label="Peso (kg)">
                        <input
                            type="number"
                            value={values.pesoKg}
                            onChange={(e) => setters.setPesoKg(e.target.value)}
                            className={cn(inputBase, fieldH, 'tabular-nums')}
                            placeholder="Ex: 1"
                        />
                    </Field>
                    <Field label="Slug (URL)">
                        <input
                            value={values.slug}
                            onChange={(e) => setters.setSlug(e.target.value)}
                            className={cn(inputBase, fieldH, 'font-mono')}
                            placeholder="pao-queijo-1kg"
                        />
                    </Field>

                    <Field label="Variação / subtítulo" className="col-span-4">
                        <input
                            type="text"
                            list={datalistId}
                            value={values.subtitulo}
                            onChange={(e) => setters.setSubtitulo(e.target.value)}
                            className={cn(inputBase, fieldH)}
                            placeholder="Ex: 75gr por unidade, 1 balde, combo"
                        />
                        <datalist id={datalistId}>
                            {SUBTITULO_SUGESTOES.map((s) => <option key={s} value={s} />)}
                        </datalist>
                    </Field>

                    <Field label="Descrição" className="col-span-2">
                        <textarea
                            rows={3}
                            value={values.descricao}
                            onChange={(e) => setters.setDescricao(e.target.value)}
                            className={cn(textareaCls, 'min-h-[72px]')}
                            placeholder="Aparece na página do produto"
                        />
                    </Field>
                    <Field label="Instruções de preparo (uma por linha)" className="col-span-2">
                        <textarea
                            rows={3}
                            value={values.instrucoesPreparo}
                            onChange={(e) => setters.setInstrucoesPreparo(e.target.value)}
                            className={cn(textareaCls, 'min-h-[72px]')}
                            placeholder="Uma por linha"
                        />
                    </Field>

                    <Field label="Checklist do card de destaque (um por linha)" className="col-span-4">
                        <textarea
                            rows={2}
                            value={values.beneficios}
                            onChange={(e) => setters.setBeneficios(e.target.value)}
                            className={cn(textareaCls, 'min-h-[56px]')}
                            placeholder={'Artesanal · Sem conservante · Queijo Canastra de verdade  (vazio = selos padrão)'}
                        />
                    </Field>

                    <Field label="Visível no catálogo">
                        <SelectWrap>
                            <select
                                value={values.visivelCatalogo ? 'true' : 'false'}
                                onChange={(e) => setters.setVisivelCatalogo(e.target.value === 'true')}
                                className={selectCls}
                            >
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </SelectWrap>
                    </Field>
                    <Field label="Destaque (carrossel)">
                        <SelectWrap>
                            <select
                                value={values.destaque ? 'true' : 'false'}
                                onChange={(e) => setters.setDestaque(e.target.value === 'true')}
                                className={selectCls}
                            >
                                <option value="true">Sim</option>
                                <option value="false">Não</option>
                            </select>
                        </SelectWrap>
                    </Field>
                    <Field label="Selo (badge)">
                        <SelectWrap>
                            <select
                                value={values.selo}
                                onChange={(e) => setters.setSelo(e.target.value)}
                                className={selectCls}
                            >
                                {SELO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </SelectWrap>
                    </Field>
                    <Field label="Seção da vitrine">
                        <SelectWrap>
                            <select
                                value={values.secaoId}
                                onChange={(e) => setters.setSecaoId(e.target.value)}
                                className={selectCls}
                            >
                                <option value="">Nenhuma</option>
                                {secaoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </SelectWrap>
                    </Field>

                    {imageSlot && <div className="col-span-4">{imageSlot}</div>}
                </div>
            )}
        </div>
    )
}
