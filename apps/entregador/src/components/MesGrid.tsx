import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toYMD } from '../lib/format'
import type { Entrega } from '../services/entregasService'

interface MesGridProps {
    mes: Date
    entregasPorDia: Map<string, Entrega[]>
    hojeStr: string
    onPrev: () => void
    onNext: () => void
    onSelecionarDia: (ymd: string) => void
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Nome curto do cliente pro chip (apelido tem prioridade). */
function nomeChip(e: Entrega): string {
    return e.cliente_apelido || e.cliente_nome || 'Cliente'
}

/** Monta as 6 semanas (42 células) começando no domingo on/before o dia 1. */
function montarCelulas(mes: Date): Date[] {
    const ano = mes.getFullYear()
    const m = mes.getMonth()
    const primeiro = new Date(ano, m, 1)
    const inicio = new Date(ano, m, 1 - primeiro.getDay()) // recua até domingo
    return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
}

export function MesGrid({ mes, entregasPorDia, hojeStr, onPrev, onNext, onSelecionarDia }: MesGridProps) {
    const celulas = montarCelulas(mes)
    const mesAtual = mes.getMonth()
    const semanas = Array.from({ length: 6 }, (_, w) => celulas.slice(w * 7, w * 7 + 7))
    const rotulo = capitalizar(mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Navegação de mês */}
            <div className="flex items-center justify-between px-2 py-2">
                <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Mês anterior">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="text-base font-bold text-foreground">{rotulo}</span>
                <Button variant="ghost" size="icon" onClick={onNext} aria-label="Próximo mês">
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-border">
                {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1.5 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                        {d}
                    </div>
                ))}
            </div>

            {/* Grade — semanas esticam pra preencher a tela */}
            <div className="flex min-h-0 flex-1 flex-col">
                {semanas.map((semana, wi) => (
                    <div key={wi} className="flex min-h-[76px] flex-1">
                        {semana.map((dia) => {
                            const ymd = toYMD(dia)
                            const foraDoMes = dia.getMonth() !== mesAtual
                            const hoje = ymd === hojeStr
                            const entregas = entregasPorDia.get(ymd) ?? []
                            const extras = entregas.length - 2
                            return (
                                <button
                                    key={ymd}
                                    type="button"
                                    onClick={() => onSelecionarDia(ymd)}
                                    className={`flex flex-1 flex-col gap-0.5 border-b border-r border-border p-1 text-left active:bg-secondary ${
                                        foraDoMes ? 'bg-muted/40' : 'bg-card'
                                    }`}
                                >
                                    <span
                                        className={`flex h-6 w-6 items-center justify-center self-start text-xs font-semibold ${
                                            hoje
                                                ? 'rounded-full bg-primary text-primary-foreground'
                                                : foraDoMes
                                                  ? 'text-muted-foreground'
                                                  : 'text-foreground'
                                        }`}
                                    >
                                        {dia.getDate()}
                                    </span>
                                    <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                                        {entregas.slice(0, 2).map((e) => (
                                            <span
                                                key={e.venda_id}
                                                className="truncate rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium leading-tight text-foreground"
                                            >
                                                {nomeChip(e)}
                                            </span>
                                        ))}
                                        {extras > 0 && (
                                            <span className="px-1 text-[10px] font-semibold text-muted-foreground">
                                                +{extras}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}
