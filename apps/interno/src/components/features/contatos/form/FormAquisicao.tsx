import { Megaphone } from 'lucide-react'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { ContatoFormData } from '@/schemas/contato'
import { useFontes } from '@/hooks/useFontes'
import { useCampanhas } from '@/hooks/useCampanhas'

interface FormAquisicaoProps {
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
}

const selectClass =
    'flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-hidden focus:ring-0'
const labelClass = 'text-[10px] font-bold text-muted-foreground uppercase tracking-wider'

export function FormAquisicao({ register, errors }: FormAquisicaoProps) {
    const { data: fontes = [] } = useFontes()
    // Cadastro = de qual campanha de TRÁFEGO o lead veio. Tráfego vem da Meta (não se
    // cadastra à mão aqui); a lista é sincronizada em /campanhas.
    const { data: campanhas = [] } = useCampanhas('aquisicao', { origem: 'meta' })

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

                {/* Campanha (opcional) — vem da Meta, sincronizada em /campanhas */}
                <div className="space-y-1">
                    <label className={labelClass}>Campanha</label>
                    <select className={selectClass} {...register('campanha_id')}>
                        <option value="">Sem campanha</option>
                        {campanhas.map(({ id, nome }) => (
                            <option key={id} value={id}>{nome}</option>
                        ))}
                    </select>
                    {campanhas.length === 0 && (
                        <p className="text-[10px] text-muted-foreground/70">
                            Sincronize as campanhas da Meta em Campanhas.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
