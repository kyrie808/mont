import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@mont/shared'
import { nomeDoMes } from '../../../utils/agenda'

interface AgendaCabecalhoProps {
    mes: string
    busca: string
    onBusca: (v: string) => void
    onHoje: () => void
    onAnterior: () => void
    onProximo: () => void
    carregando: boolean
}

const VISOES = [
    { id: 'mes', rotulo: 'Mês', ativa: true },
    { id: 'semana', rotulo: 'Semana', ativa: false },
    { id: 'dia', rotulo: 'Dia', ativa: false },
] as const

/** Cabeçalho do Google: Hoje, ‹ ›, nome do mês, busca e seletor de visão. */
export function AgendaCabecalho({ mes, busca, onBusca, onHoje, onAnterior, onProximo, carregando }: AgendaCabecalhoProps) {
    return (
        <header className="flex h-16 shrink-0 items-center gap-4">
            <h1 className="mr-2 text-xl font-semibold text-foreground">Agenda</h1>
            <button
                type="button"
                onClick={onHoje}
                className="h-9 rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                Hoje
            </button>
            <div className="flex">
                <button type="button" aria-label="Mês anterior" onClick={onAnterior}
                    className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <ChevronLeft className="size-5" />
                </button>
                <button type="button" aria-label="Próximo mês" onClick={onProximo}
                    className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                    <ChevronRight className="size-5" />
                </button>
            </div>
            <h2 className={cn('whitespace-nowrap text-xl text-foreground transition-opacity', carregando && 'opacity-60')}>{nomeDoMes(mes)}</h2>

            <div className="ml-auto flex items-center gap-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        aria-label="Buscar por cliente ou título"
                        placeholder="Cliente ou título"
                        value={busca}
                        onChange={(e) => onBusca(e.target.value)}
                        className="h-9 w-44 rounded-full border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="Visão">
                    {VISOES.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            disabled={!v.ativa}
                            aria-pressed={v.ativa}
                            title={v.ativa ? undefined : 'Na próxima etapa'}
                            className={cn(
                                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                                v.ativa ? 'bg-primary/15 text-foreground' : 'cursor-not-allowed text-muted-foreground/50',
                            )}
                        >
                            {v.rotulo}
                        </button>
                    ))}
                </div>
            </div>
        </header>
    )
}
