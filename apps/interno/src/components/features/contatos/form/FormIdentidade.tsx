import { User } from 'lucide-react'
import { Input } from '@/components/ui'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { ContatoFormData } from '@/schemas/contato'

interface FormIdentidadeProps {
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
}

export function FormIdentidade({ register, errors }: FormIdentidadeProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" /> Identidade
            </h3>
            <div className="grid grid-cols-1 gap-4">
                <Input
                    label="NOME COMPLETO *"
                    error={errors.nome?.message}
                    className="bg-muted/50 border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0 text-lg"
                    {...register('nome')}
                />
                <Input
                    label="APELIDO"
                    error={errors.apelido?.message}
                    className="bg-muted/50 border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...register('apelido')}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="TELEFONE *"
                        error={errors.telefone?.message}
                        className="bg-muted/50 border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                        {...register('telefone')}
                    />
                </div>
            </div>
        </div>
    )
}
