import { Megaphone } from 'lucide-react'
import { useFontes } from '@/hooks/useFontes'
import { useCampanhas } from '@/hooks/useCampanhas'
import type { DomainContato } from '@/types/domain'

/**
 * Mostra a aquisição (fonte + campanha) do cliente quando origem = 'anuncio'.
 * Resolve os rótulos via lookups cacheados (useFontes/useCampanhas).
 */
export function AquisicaoCard({ contato }: { contato: DomainContato }) {
    const { data: fontes = [] } = useFontes()
    const { data: campanhas = [] } = useCampanhas()

    if (contato.origem !== 'anuncio') return null

    const fonteLabel = fontes.find((f) => f.slug === contato.fonte)?.label ?? contato.fonte ?? '—'
    const campanhaNome = contato.campanhaId
        ? (campanhas.find((c) => c.id === contato.campanhaId)?.nome ?? '—')
        : 'Sem campanha'

    return (
        <div className="flex items-start gap-4 p-5 bg-card border border-border rounded-xl shadow-card">
            <Megaphone className="h-6 w-6 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        Fonte
                    </p>
                    <p className="text-sm font-semibold text-foreground">{fonteLabel}</p>
                </div>
                <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        Campanha
                    </p>
                    <p className="text-sm font-semibold text-foreground">{campanhaNome}</p>
                </div>
            </div>
        </div>
    )
}
