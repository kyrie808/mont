import { useState } from 'react'
import { Megaphone, Plus, Check, X } from 'lucide-react'
import type { UseFormRegister, FieldErrors, UseFormSetValue } from 'react-hook-form'
import type { ContatoFormData } from '@/schemas/contato'
import { useFontes } from '@/hooks/useFontes'
import { useCampanhas } from '@/hooks/useCampanhas'
import { useToast } from '@/components/ui/Toast'

interface FormAquisicaoProps {
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
    setValue: UseFormSetValue<ContatoFormData>
}

const selectClass =
    'flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-hidden focus:ring-0'
const labelClass = 'text-[10px] font-bold text-muted-foreground uppercase tracking-wider'

export function FormAquisicao({ register, errors, setValue }: FormAquisicaoProps) {
    const toast = useToast()
    const { data: fontes = [] } = useFontes()
    // Cadastro = campanha de AQUISIÇÃO (anúncio). Criação inline nasce tipo='aquisicao'.
    const { data: campanhas = [], criar } = useCampanhas('aquisicao')

    const [showNovaCampanha, setShowNovaCampanha] = useState(false)
    const [novaCampanha, setNovaCampanha] = useState('')

    const handleCriarCampanha = async () => {
        try {
            const nova = await criar.mutateAsync(novaCampanha)
            setValue('campanha_id', nova.id, { shouldValidate: true })
            setNovaCampanha('')
            setShowNovaCampanha(false)
            toast.success('Campanha criada!')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao criar campanha')
        }
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-left-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Megaphone className="w-4 h-4" /> Aquisição (Anúncio)
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-white/5">
                {/* Fonte (obrigatória) */}
                <div className="space-y-1">
                    <label className={labelClass}>Fonte *</label>
                    <select className={selectClass} {...register('fonte')}>
                        <option value="">Selecione...</option>
                        {fontes.map(({ slug, label }) => (
                            <option key={slug} value={slug}>{label}</option>
                        ))}
                    </select>
                    {errors.fonte?.message && (
                        <p className="text-xs text-destructive">{String(errors.fonte.message)}</p>
                    )}
                </div>

                {/* Campanha (opcional, com criação inline) */}
                <div className="space-y-1">
                    <label className={labelClass}>Campanha</label>
                    {showNovaCampanha ? (
                        <div className="flex items-center gap-1">
                            <input
                                autoFocus
                                value={novaCampanha}
                                onChange={(e) => setNovaCampanha(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleCriarCampanha() }
                                    if (e.key === 'Escape') { setShowNovaCampanha(false); setNovaCampanha('') }
                                }}
                                placeholder="Nome da campanha"
                                className={selectClass}
                            />
                            <button
                                type="button"
                                onClick={handleCriarCampanha}
                                disabled={criar.isPending || !novaCampanha.trim()}
                                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                                aria-label="Criar campanha"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowNovaCampanha(false); setNovaCampanha('') }}
                                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border text-muted-foreground"
                                aria-label="Cancelar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <select className={selectClass} {...register('campanha_id')}>
                                <option value="">Sem campanha</option>
                                {campanhas.map(({ id, nome }) => (
                                    <option key={id} value={id}>{nome}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setShowNovaCampanha(true)}
                                className="shrink-0 h-10 w-10 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                aria-label="Nova campanha"
                                title="Nova campanha"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
