import { Tabs, TabsList, TabsTrigger, Button } from '../../ui'
import type { EntregadorOption } from '../../../services/entregadorService'

interface EntregasDesktopToolbarProps {
    mes: string
    onMesChange: (mes: string) => void
    entregadores: EntregadorOption[]
    filtroEntregador: string
    onFiltroEntregadorChange: (id: string) => void
    incluirEntregues: boolean
    onIncluirEntreguesChange: (v: boolean) => void
}

// Barra de filtro SÓ desktop. Mês é `<input type=month>` ligado ao estado local da página
// (independente do filtro global — decisão do diretor). Entregador vira segmented control;
// "Incluir entregues" vira toggle. No mobile nada disto aparece (segue com select/checkbox).
export function EntregasDesktopToolbar({
    mes,
    onMesChange,
    entregadores,
    filtroEntregador,
    onFiltroEntregadorChange,
    incluirEntregues,
    onIncluirEntreguesChange,
}: EntregasDesktopToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-4">
            <input
                type="month"
                value={mes}
                onChange={(e) => onMesChange(e.target.value)}
                aria-label="Mês"
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            />

            <div className="min-w-0 flex-1">
                <Tabs value={filtroEntregador} onValueChange={onFiltroEntregadorChange}>
                    <TabsList>
                        <TabsTrigger value="">Todos</TabsTrigger>
                        {entregadores.map((e) => (
                            <TabsTrigger key={e.id} value={e.id}>{e.nome}</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            <Button
                variant={incluirEntregues ? 'primary' : 'outline'}
                size="sm"
                className="shrink-0"
                aria-pressed={incluirEntregues}
                onClick={() => onIncluirEntreguesChange(!incluirEntregues)}
            >
                Incluir entregues
            </Button>
        </div>
    )
}
