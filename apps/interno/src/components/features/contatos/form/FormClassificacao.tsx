import { Target } from 'lucide-react'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { ContatoFormData } from '@/schemas/contato'
import {
    CONTATO_TIPO_LABELS,
    CONTATO_ORIGEM_LABELS,
    SUBTIPOS_B2B_LABELS,
    CONTATO_STATUS_LABELS,
} from '@/constants'

interface FormClassificacaoProps {
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
    tipoValue: string
}

export function FormClassificacao({ register, errors, tipoValue }: FormClassificacaoProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" /> Classificação
            </h3>
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-white/5">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</label>
                    <select
                        className="flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-0"
                        {...register('tipo')}
                    >
                        {Object.entries(CONTATO_TIPO_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    {errors.tipo?.message && <p className="text-xs text-destructive">{String(errors.tipo.message)}</p>}
                </div>

                {tipoValue === 'B2B' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-left-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subtipo</label>
                        <select
                            className="flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-0"
                            {...register('subtipo')}
                        >
                            <option value="">Selecione...</option>
                            {Object.entries(SUBTIPOS_B2B_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                    <select
                        className="flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-0"
                        {...register('status')}
                    >
                        {Object.entries(CONTATO_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Origem</label>
                    <select
                        className="flex h-10 w-full rounded-md border border-black/20 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-0"
                        {...register('origem')}
                    >
                        {Object.entries(CONTATO_ORIGEM_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    )
}
