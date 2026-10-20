import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@mont/shared'
import {
    CAMADAS, gradeDoMes, mesDoDia, nomeDoMes, somarMeses, type Camada, type CamadasLigadas,
} from '../../../utils/agenda'
import { VISUAL_CAMADA } from './camadasVisual'

interface AgendaLateralProps {
    mes: string
    hoje: string
    camadas: CamadasLigadas
    onAlternarCamada: (c: Camada) => void
    onIrPara: (dia: string) => void
    onCriar: () => void
}

const LETRAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/** Lateral do Google Agenda: Criar, mini-calendário e "Minhas agendas" (as camadas). */
export function AgendaLateral({ mes, hoje, camadas, onAlternarCamada, onIrPara, onCriar }: AgendaLateralProps) {
    // O mini-calendário navega sozinho; quando a grade muda de mês, ele acompanha
    // (ajuste no render, sem efeito: https://react.dev/learn/you-might-not-need-an-effect).
    const [mesMini, setMesMini] = useState(mes)
    const [mesDaGrade, setMesDaGrade] = useState(mes)
    if (mes !== mesDaGrade) {
        setMesDaGrade(mes)
        setMesMini(mes)
    }

    return (
        <aside className="flex w-56 shrink-0 flex-col gap-6">
            <button
                type="button"
                onClick={onCriar}
                className="inline-flex w-fit items-center gap-3 rounded-2xl bg-card px-5 py-4 text-sm font-semibold text-foreground shadow-card ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <Plus className="size-5 text-primary" />
                Criar
            </button>

            <div>
                <div className="mb-1 flex items-center justify-between pl-2">
                    <span className="text-sm font-semibold text-foreground">{nomeDoMes(mesMini)}</span>
                    <div className="flex">
                        <button type="button" aria-label="Mês anterior" onClick={() => setMesMini(somarMeses(mesMini, -1))}
                            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <ChevronLeft className="size-4" />
                        </button>
                        <button type="button" aria-label="Próximo mês" onClick={() => setMesMini(somarMeses(mesMini, 1))}
                            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-muted-foreground">
                    {LETRAS.map((l, i) => <span key={i} className="py-1">{l}</span>)}
                </div>
                <div className="grid grid-cols-7 text-center text-[11px]">
                    {gradeDoMes(mesMini).flat().map((d) => {
                        const ehHoje = d.dia === hoje
                        const noMesDaGrade = mesDoDia(d.dia) === mes
                        return (
                            <button
                                key={d.dia}
                                type="button"
                                onClick={() => onIrPara(d.dia)}
                                aria-label={`Ir para ${d.dia.split('-').reverse().join('/')}`}
                                className={cn(
                                    'mx-auto inline-flex size-7 items-center justify-center rounded-full tabular-nums transition-colors',
                                    ehHoje
                                        ? 'bg-primary font-bold text-primary-foreground'
                                        : cn('hover:bg-muted', d.doMes ? 'text-foreground' : 'text-muted-foreground/50', noMesDaGrade && d.doMes && 'font-medium'),
                                )}
                            >
                                {d.numero}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div>
                <p className="mb-2 pl-2 text-sm font-semibold text-foreground">Camadas</p>
                <ul className="space-y-0.5">
                    {CAMADAS.map((c) => (
                        <li key={c.id}>
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted">
                                <input
                                    type="checkbox"
                                    checked={camadas[c.id]}
                                    onChange={() => onAlternarCamada(c.id)}
                                    className={cn('size-4 rounded', VISUAL_CAMADA[c.id].caixa)}
                                />
                                <span className={cn('size-2.5 rounded-full', VISUAL_CAMADA[c.id].ponto)} aria-hidden="true" />
                                {c.rotulo}
                            </label>
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    )
}
