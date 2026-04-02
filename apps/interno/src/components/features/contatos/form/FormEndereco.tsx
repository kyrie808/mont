import { MapPin, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { ContatoFormData } from '@/schemas/contato'

interface FormEnderecoProps {
    register: UseFormRegister<ContatoFormData>
    errors: FieldErrors<ContatoFormData>
    loadingCep: boolean
}

export function FormEndereco({ register, loadingCep }: FormEnderecoProps) {
    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Endereço
            </h3>

            <div className="bg-muted/30 border border-white/5 rounded-xl p-4 space-y-4">
                <div className="flex gap-4">
                    <div className="w-[140px] relative">
                        <Input
                            label="CEP"
                            maxLength={9}
                            className="bg-background/50 border-black/20 font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
                            {...register('cep')}
                        />
                        {loadingCep && (
                            <div className="absolute right-3 top-[38px]">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <Input
                            label="LOGRADOURO"
                            readOnly
                            className="bg-muted text-muted-foreground border-none opacity-70"
                            {...register('logradouro')}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-4">
                    <Input
                        label="NÚMERO"
                        className="bg-background/50 border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                        {...register('numero')}
                    />
                    <Input
                        label="COMPLEMENTO"
                        className="bg-background/50 border-black/20 focus-visible:ring-0 focus-visible:ring-offset-0"
                        {...register('complemento')}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="BAIRRO"
                        readOnly
                        className="bg-muted text-muted-foreground border-none opacity-70"
                        {...register('bairro')}
                    />
                    <div className="grid grid-cols-[1fr_60px] gap-2">
                        <Input
                            label="CIDADE"
                            readOnly
                            className="bg-muted text-muted-foreground border-none opacity-70"
                            {...register('cidade')}
                        />
                        <Input
                            label="UF"
                            readOnly
                            className="bg-muted text-muted-foreground border-none opacity-70 text-center px-0"
                            {...register('uf')}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
