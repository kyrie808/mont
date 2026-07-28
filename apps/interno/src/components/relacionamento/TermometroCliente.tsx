import { cn } from '@mont/shared'
import { Thermometer } from 'lucide-react'
import { temperaturaCliente, TEMPERATURA_BADGE, type RitmoCliente, type Temperatura } from '../../utils/temperaturaCliente'

// Gauge de 3 zonas (frio · morno · quente) com a zona ativa acesa + selo + frase do porquê.
// Usado no perfil do cliente. A lista/card reusam o TEMPERATURA_BADGE inline (padrão do segmento).

const ZONAS: { id: Exclude<Temperatura, 'novo'>; on: string }[] = [
    { id: 'frio', on: 'bg-destructive' },
    { id: 'morno', on: 'bg-warning' },
    { id: 'quente', on: 'bg-success' },
]

export function TermometroCliente({ ritmo }: { ritmo: RitmoCliente | null | undefined }) {
    const { estado, motivo } = temperaturaCliente(ritmo)
    const badge = TEMPERATURA_BADGE[estado]

    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Thermometer className="h-3.5 w-3.5" /> Termômetro
                </span>
                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', badge.cls)}>
                    {badge.label}
                </span>
            </div>

            <div className="mt-3 flex gap-1" aria-hidden="true">
                {ZONAS.map((z) => (
                    <div
                        key={z.id}
                        className={cn(
                            'h-2 flex-1 rounded-full transition-colors',
                            estado === z.id ? z.on : 'bg-muted',
                        )}
                    />
                ))}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">{motivo}</p>
        </div>
    )
}
