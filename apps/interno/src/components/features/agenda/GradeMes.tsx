import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@mont/shared'
import { cortarChips, DIAS_SEMANA_CURTOS, paraData, type ChipAgenda, type DiaDaGrade } from '../../../utils/agenda'
import { ChipComDetalhe, ChipVencimentosAgregado, MaisDoDia } from './ChipsAgenda'
import type { PrefillLembrete } from './CriacaoRapida'

interface GradeMesProps {
    semanas: DiaDaGrade[][]
    chips: Map<string, ChipAgenda[]>
    hoje: string
    /** Clique em espaço vazio de um dia → criação rápida com a data. */
    onCriar: (prefill: PrefillLembrete) => void
}

function chaveDoChip(c: ChipAgenda): string {
    return c.tipo === 'item' ? `${c.item.origem}-${c.item.id}` : `vencimentos-${c.itens[0]?.data ?? ''}`
}

/** A grade de 7 colunas (domingo a sábado), 5 ou 6 semanas, como o Google Agenda. */
export function GradeMes({ semanas, chips, hoje, onCriar }: GradeMesProps) {
    const primeiroDoMes = semanas.flat().find((d) => d.doMes)?.dia

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-7 border-b border-border">
                {DIAS_SEMANA_CURTOS.map((d) => (
                    <div key={d} className="py-2 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">{d}</div>
                ))}
            </div>

            <div
                className="grid min-h-0 flex-1 grid-cols-7"
                style={{ gridTemplateRows: `repeat(${semanas.length}, minmax(7.5rem, 1fr))` }}
            >
                {semanas.flat().map((d, idx) => {
                    const doDia = chips.get(d.dia) ?? []
                    const { visiveis, mais } = cortarChips(doDia)
                    const ehHoje = d.dia === hoje
                    // "1 out." no primeiro dia de cada mês visível, como no Google.
                    const rotuloNumero = d.numero === 1
                        ? `${d.numero} ${format(paraData(d.dia), 'MMM', { locale: ptBR })}.`
                        : String(d.numero)
                    const rotuloDia = format(paraData(d.dia), "EEEE, d 'de' MMMM", { locale: ptBR })

                    return (
                        <div
                            key={d.dia}
                            role="button"
                            tabIndex={-1}
                            aria-label={`Criar lembrete em ${rotuloDia}`}
                            onClick={() => onCriar({ data: d.dia })}
                            className={cn(
                                'group flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-border p-1 transition-colors hover:bg-foreground/[0.03]',
                                idx % 7 !== 6 && 'border-r',
                                idx < (semanas.length - 1) * 7 && 'border-b',
                            )}
                        >
                            <div className="flex justify-center pb-0.5">
                                <span
                                    className={cn(
                                        'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums',
                                        ehHoje
                                            ? 'bg-primary font-bold text-primary-foreground'
                                            : d.doMes ? 'text-foreground' : 'text-muted-foreground/60',
                                        d.dia === primeiroDoMes && !ehHoje && 'font-semibold',
                                    )}
                                >
                                    {rotuloNumero}
                                </span>
                            </div>
                            {visiveis.map((c) =>
                                c.tipo === 'item'
                                    ? <ChipComDetalhe key={chaveDoChip(c)} item={c.item} onCriarRetorno={onCriar} />
                                    : <ChipVencimentosAgregado key={chaveDoChip(c)} itens={c.itens} total={c.total} onCriarRetorno={onCriar} />,
                            )}
                            {mais > 0 && (
                                <MaisDoDia mais={mais} chips={doDia} rotuloDia={rotuloDia.charAt(0).toUpperCase() + rotuloDia.slice(1)} onCriarRetorno={onCriar} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
