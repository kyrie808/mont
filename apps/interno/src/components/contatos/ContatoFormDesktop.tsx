import type { MutableRefObject, ReactNode, RefObject } from 'react'
import type { UseFormRegister, FieldErrors, UseFormSetValue } from 'react-hook-form'
import {
    User, Target, Megaphone, Users, MapPin, FileText,
    Search, X, ChevronDown, Loader2,
} from 'lucide-react'
import { cn, formatPhone } from '@mont/shared'
import type { ContatoFormData } from '../../schemas/contato'
import type { DomainContato, IndicadorRef } from '../../types/domain'
import { CONTATO_TIPO_LABELS, SUBTIPOS_B2B_LABELS, CONTATO_STATUS_LABELS } from '../../constants'
import { useOrigens } from '../../hooks/useOrigens'
import { useFontes } from '../../hooks/useFontes'
import { useCampanhas } from '../../hooks/useCampanhas'
import { ModalActions, Button } from '../ui'

// Mesmo inputBase do LancamentoModal (padrão v2 do Design System §4).
const inputBase =
    'flex w-full rounded-xl border border-input bg-background text-foreground ring-offset-background ' +
    'placeholder:text-muted-foreground/50 focus-visible:outline-hidden focus-visible:ring-2 ' +
    'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
const fieldH = 'h-12 px-3 py-2 text-sm'
const selectCls = cn(inputBase, fieldH, 'appearance-none pr-9')
const readOnlyCls = cn(inputBase, fieldH, 'bg-muted/60 text-muted-foreground border-transparent opacity-80')
const labelCls = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1'

function Eyebrow({ icon: Icon, children }: { icon: typeof User; children: ReactNode }) {
    return (
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
            <Icon className="h-4 w-4" /> {children}
        </div>
    )
}

function Field({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: ReactNode
}) {
    return (
        <div>
            <label className={labelCls}>
                {label}{required && <span className="text-destructive"> *</span>}
            </label>
            {children}
            {error && <p className="mt-1 px-1 text-xs text-destructive">{error}</p>}
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
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
    setValue: UseFormSetValue<ContatoFormData>
    tipoValue: string
    origemValue: string
    loadingCep: boolean
    isEditing: boolean
    isSubmitting: boolean
    onCancel: () => void
    submitModeRef: MutableRefObject<'close' | 'again'>
    // Autocomplete de indicador (controlado pelo modal pai)
    dropdownRef: RefObject<HTMLDivElement | null>
    selectedIndicador: IndicadorRef | null
    indicadorSearch: string
    setIndicadorSearch: (v: string) => void
    showIndicadorDropdown: boolean
    indicadorResults: DomainContato[]
    onClearIndicador: () => void
    onSelectIndicador: (c: DomainContato) => void
}

export function ContatoFormDesktop({
    register, errors, tipoValue, origemValue, loadingCep,
    isEditing, isSubmitting, onCancel, submitModeRef,
    dropdownRef, selectedIndicador, indicadorSearch, setIndicadorSearch,
    showIndicadorDropdown, indicadorResults, onClearIndicador, onSelectIndicador,
}: Props) {
    const { data: origens = [] } = useOrigens()
    const { data: fontes = [] } = useFontes()
    const { data: campanhas = [] } = useCampanhas('aquisicao', { origem: 'meta' })
    const isB2B = tipoValue === 'B2B'
    const telefoneField = register('telefone')

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
                {/* ── COLUNA ESQUERDA ─────────────────────────────────────── */}
                <div className="space-y-5">
                    {/* Identidade */}
                    <div className="space-y-3">
                        <Eyebrow icon={User}>Identidade</Eyebrow>
                        <Field label="Nome completo" required error={errors.nome?.message}>
                            <input
                                autoFocus
                                {...register('nome')}
                                className={cn(inputBase, 'h-12 px-3 py-2 text-base font-medium',
                                    errors.nome && 'border-destructive focus-visible:ring-destructive')}
                                placeholder="Nome do contato"
                            />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Apelido">
                                <input {...register('apelido')} className={cn(inputBase, fieldH)} placeholder="Opcional" />
                            </Field>
                            <Field label="Telefone" required error={errors.telefone?.message}>
                                <input
                                    {...telefoneField}
                                    onChange={(e) => {
                                        // Formata enquanto digita; o schema/serviço limpam de volta na gravação.
                                        e.target.value = formatPhone(e.target.value)
                                        telefoneField.onChange(e)
                                    }}
                                    maxLength={15}
                                    inputMode="numeric"
                                    className={cn(inputBase, fieldH, 'font-mono',
                                        errors.telefone && 'border-destructive focus-visible:ring-destructive')}
                                    placeholder="(11) 91234-5678"
                                />
                            </Field>
                        </div>
                    </div>

                    {/* Classificação */}
                    <div className="space-y-3">
                        <Eyebrow icon={Target}>Classificação</Eyebrow>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Tipo">
                                <SelectWrap>
                                    <select {...register('tipo')} className={selectCls}>
                                        {Object.entries(CONTATO_TIPO_LABELS).map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </select>
                                </SelectWrap>
                            </Field>
                            <Field label="Status">
                                <SelectWrap>
                                    <select {...register('status')} className={selectCls}>
                                        {Object.entries(CONTATO_STATUS_LABELS).map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </select>
                                </SelectWrap>
                            </Field>
                            <div className="col-span-2">
                                <Field label="Origem">
                                    <SelectWrap>
                                        <select {...register('origem')} className={selectCls}>
                                            {origens.map(({ slug, label }) => (
                                                <option key={slug} value={slug}>{label}</option>
                                            ))}
                                        </select>
                                    </SelectWrap>
                                </Field>
                            </div>
                            {isB2B && (
                                <div className="col-span-2 animate-in fade-in slide-in-from-top-1">
                                    <Field label="Subtipo (B2B)">
                                        <SelectWrap>
                                            <select {...register('subtipo')} className={selectCls}>
                                                <option value="">Selecione…</option>
                                                {Object.entries(SUBTIPOS_B2B_LABELS).map(([v, l]) => (
                                                    <option key={v} value={v}>{l}</option>
                                                ))}
                                            </select>
                                        </SelectWrap>
                                    </Field>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bloco condicional de origem */}
                    {origemValue === 'anuncio' && (
                        <div className="animate-in fade-in slide-in-from-top-1 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                            <Eyebrow icon={Megaphone}>Aquisição (Anúncio)</Eyebrow>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Fonte" required error={errors.fonte?.message}>
                                    <SelectWrap>
                                        <select {...register('fonte')} className={selectCls}>
                                            <option value="">Selecione…</option>
                                            {fontes.map(({ slug, label }) => (
                                                <option key={slug} value={slug}>{label}</option>
                                            ))}
                                        </select>
                                    </SelectWrap>
                                </Field>
                                <Field label="Campanha">
                                    <SelectWrap>
                                        <select {...register('campanha_id')} className={selectCls}>
                                            <option value="">Sem campanha</option>
                                            {campanhas.map(({ id, nome }) => (
                                                <option key={id} value={id}>{nome}</option>
                                            ))}
                                        </select>
                                    </SelectWrap>
                                </Field>
                            </div>
                            {campanhas.length === 0 && (
                                <p className="px-1 text-[11px] text-muted-foreground/70">
                                    Sincronize as campanhas da Meta em Campanhas.
                                </p>
                            )}
                        </div>
                    )}

                    {origemValue === 'indicacao' && (
                        <div
                            ref={dropdownRef}
                            className="animate-in fade-in slide-in-from-top-1 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
                        >
                            <Eyebrow icon={Users}>Indicação</Eyebrow>
                            {selectedIndicador ? (
                                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 p-3">
                                    <div>
                                        <p className="font-medium text-foreground">{selectedIndicador.nome}</p>
                                        {selectedIndicador.telefone && (
                                            <p className="text-xs text-muted-foreground">{formatPhone(selectedIndicador.telefone)}</p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClearIndicador}
                                        aria-label="Remover indicador"
                                        className="rounded p-1 text-primary transition-colors hover:bg-primary/20"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={indicadorSearch}
                                        onChange={(e) => setIndicadorSearch(e.target.value)}
                                        placeholder="Buscar quem indicou…"
                                        className={cn(inputBase, fieldH, 'pl-9')}
                                    />
                                    {showIndicadorDropdown && indicadorResults.length > 0 && (
                                        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
                                            {indicadorResults.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => onSelectIndicador(c)}
                                                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                                                >
                                                    <span>
                                                        <span className="block font-medium">{c.nome}</span>
                                                        <span className="block text-xs opacity-70">{formatPhone(c.telefone)}</span>
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── COLUNA DIREITA ──────────────────────────────────────── */}
                <div className="space-y-5">
                    {/* Endereço */}
                    <div className="space-y-3">
                        <Eyebrow icon={MapPin}>Endereço</Eyebrow>
                        <div className="grid grid-cols-[140px_1fr] gap-3">
                            <Field label="CEP">
                                <div className="relative">
                                    <input
                                        {...register('cep')}
                                        maxLength={9}
                                        placeholder="00000-000"
                                        className={cn(inputBase, fieldH, 'font-mono')}
                                    />
                                    {loadingCep && (
                                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                                    )}
                                </div>
                            </Field>
                            <Field label="Logradouro">
                                <input {...register('logradouro')} readOnly className={readOnlyCls} placeholder="Preenchido pelo CEP" />
                            </Field>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] gap-3">
                            <Field label="Número">
                                <input {...register('numero')} className={cn(inputBase, fieldH)} />
                            </Field>
                            <Field label="Complemento">
                                <input {...register('complemento')} className={cn(inputBase, fieldH)} placeholder="Apto, bloco…" />
                            </Field>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_64px] gap-3">
                            <Field label="Bairro">
                                <input {...register('bairro')} readOnly className={readOnlyCls} />
                            </Field>
                            <Field label="Cidade">
                                <input {...register('cidade')} readOnly className={readOnlyCls} />
                            </Field>
                            <Field label="UF">
                                <input {...register('uf')} readOnly className={cn(readOnlyCls, 'px-0 text-center')} />
                            </Field>
                        </div>
                    </div>

                    {/* Observações */}
                    <div className="space-y-3">
                        <Eyebrow icon={FileText}>Observações</Eyebrow>
                        <textarea
                            {...register('observacoes')}
                            className={cn(inputBase, 'min-h-[96px] px-3 py-2 text-sm resize-none')}
                            placeholder="Notas internas sobre o contato…"
                        />
                    </div>
                </div>
            </div>

            <ModalActions>
                <Button type="button" variant="ghost" onClick={onCancel} className="text-muted-foreground">
                    Cancelar
                </Button>
                {!isEditing && (
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={isSubmitting}
                        onClick={() => { submitModeRef.current = 'again' }}
                    >
                        Salvar e novo
                    </Button>
                )}
                <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting}
                    className="px-6 font-bold"
                    onClick={() => { submitModeRef.current = 'close' }}
                >
                    {isEditing ? 'Salvar Alterações' : 'Criar Contato'}
                </Button>
            </ModalActions>
        </div>
    )
}
