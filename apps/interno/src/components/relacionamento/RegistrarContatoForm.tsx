import { useState, type FormEvent } from 'react'
import { cn } from '@mont/shared'
import { useRegistrarPontoContato, type Canal, type ResultadoPontoContato } from '../../hooks/useInteracoes'

const CANAL_OPTIONS: Array<{ value: Canal; label: string }> = [
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'google', label: 'Google' },
    { value: 'outro', label: 'Outro' },
]

const RESULTADO_PONTO_OPTIONS: Array<{ value: ResultadoPontoContato; label: string }> = [
    { value: 'respondeu', label: 'Respondeu' },
    { value: 'sem_resposta', label: 'Sem resposta' },
    { value: 'aceitou', label: 'Aceitou' },
    { value: 'recusou', label: 'Recusou' },
]

// Form de registro de ponto de contato (sua abordagem ao cliente). Reutilizado no
// side-sheet do kanban (PerfilSideSheet) e no perfil do cliente (ContatoDetalhe).
export function RegistrarContatoForm({ contatoId, onClose }: { contatoId: string; onClose: () => void }) {
    const [canal, setCanal] = useState<Canal>('whatsapp')
    const [resultado, setResultado] = useState<ResultadoPontoContato>('respondeu')
    const [observacao, setObservacao] = useState('')
    const { mutate, isPending, error: mutError } = useRegistrarPontoContato()

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (isPending) return
        mutate(
            { contatoId, canal, resultado, observacao: observacao.trim() || undefined },
            { onSuccess: () => { setObservacao(''); onClose() } },
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
            {/* Plataforma */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Plataforma</p>
                <select
                    value={canal}
                    onChange={(e) => setCanal(e.target.value as Canal)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-border bg-foreground/4 px-2.5 py-1.5 text-[12px] text-foreground outline-hidden focus:border-primary/40 disabled:opacity-50"
                >
                    {CANAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-card">
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Resposta */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Resposta</p>
                <div className="flex flex-wrap gap-1.5">
                    {RESULTADO_PONTO_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            disabled={isPending}
                            onClick={() => setResultado(opt.value)}
                            className={cn(
                                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50',
                                resultado === opt.value
                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                    : 'border-border bg-foreground/3 text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Nota */}
            <div className="space-y-1.5">
                <p className="text-[10.5px] font-semibold text-muted-foreground/60">Nota (opcional)</p>
                <textarea
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    disabled={isPending}
                    placeholder="Detalhe o contato…"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-foreground/4 px-2.5 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/40 outline-hidden focus:border-primary/40 disabled:opacity-50"
                />
            </div>

            {mutError && <p className="text-[11px] text-destructive">{mutError.message}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 rounded-lg bg-primary/15 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isPending ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="rounded-lg px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                    Cancelar
                </button>
            </div>
        </form>
    )
}
