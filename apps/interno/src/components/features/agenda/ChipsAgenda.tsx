import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { cn, formatCurrency, type ItemAgenda } from '@mont/shared'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui'
import { camadaDoItem, horaCurta, rotuloDoItem, rotuloDoLembrete, valorCurto, type ChipAgenda } from '../../../utils/agenda'
import { ICONE_CAMADA, ICONE_TIPO, tipoDoLembrete, VISUAL_CAMADA } from './camadasVisual'
import { DetalheItem } from './DetalheItem'
import type { PrefillLembrete } from './CriacaoRapida'

type CriarRetorno = (prefill: PrefillLembrete) => void

const baseChip =
    'flex w-full min-w-0 items-center gap-1 rounded-md border-l-[3px] px-1.5 py-[3px] text-left text-xs leading-tight text-foreground ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * O chip na célula do mês (Google: barra colorida com o título), sempre em UMA linha.
 * Lembrete: ícone do tipo + cliente primeiro ('Simone · cobrança'); o título inteiro fica no tooltip.
 */
const ChipBotao = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & { item: ItemAgenda }>(
    ({ item, className, ...props }, ref) => {
        const feito = item.situacao === 'feito'
        const camada = camadaDoItem(item)
        const ehLembrete = item.origem === 'lembrete'
        const Icone = ehLembrete ? ICONE_TIPO[tipoDoLembrete(item.tipo)] : null
        const valor = item.origem === 'retomada' ? null : item.valor
        const dica = ehLembrete
            ? item.titulo
            : `${rotuloDoItem(item)}${valor !== null ? ` · ${formatCurrency(valor)}` : ''}`
        return (
            <button
                ref={ref}
                type="button"
                title={dica}
                className={cn(baseChip, VISUAL_CAMADA[camada].chip, feito && 'opacity-55', className)}
                {...props}
            >
                {Icone && <Icone className={cn('size-3 shrink-0', VISUAL_CAMADA[camada].icone)} aria-hidden="true" />}
                {item.hora && <span className="shrink-0 font-semibold tabular-nums">{horaCurta(item.hora)}</span>}
                {ehLembrete ? (
                    <>
                        {/* Lembrete: o texto encolhe (…), o valor fica sempre inteiro. */}
                        <span className={cn('truncate', feito && 'line-through', item.atrasado && 'font-semibold text-destructive')}>
                            {rotuloDoLembrete(item)}
                        </span>
                        {valor !== null && (
                            <span className="shrink-0 tabular-nums text-muted-foreground">{valorCurto(valor)}</span>
                        )}
                    </>
                ) : (
                    /* Nome e valor num texto só: o nome vem primeiro e o corte (…) cai no fim. */
                    <span className={cn('truncate', feito && 'line-through', item.atrasado && 'font-semibold text-destructive')}>
                        {rotuloDoItem(item)}
                        {valor !== null && (
                            <span className="font-normal tabular-nums text-muted-foreground"> · {formatCurrency(valor)}</span>
                        )}
                    </span>
                )}
            </button>
        )
    },
)
ChipBotao.displayName = 'ChipBotao'

/** Um item → chip que abre o detalhe. */
export function ChipComDetalhe({ item, onCriarRetorno }: { item: ItemAgenda; onCriarRetorno: CriarRetorno }) {
    const [aberto, setAberto] = useState(false)
    return (
        <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
                <ChipBotao item={item} onClick={(e) => e.stopPropagation()} />
            </PopoverTrigger>
            <PopoverContent className="w-96" onClick={(e) => e.stopPropagation()}>
                <DetalheItem item={item} onFechar={() => setAberto(false)} onCriarRetorno={onCriarRetorno} />
            </PopoverContent>
        </Popover>
    )
}

/**
 * Lista de itens dentro de um popover; clicar num deles troca para o detalhe (com voltar).
 * Usada no chip agregado de vencimentos, no "+N mais" e na faixa de Atrasados.
 */
export function ListaComDetalhe({
    titulo, subtitulo, itens, onFechar, onCriarRetorno, mostrarData = false,
}: {
    titulo: ReactNode
    subtitulo?: ReactNode
    itens: ItemAgenda[]
    onFechar: () => void
    onCriarRetorno: CriarRetorno
    mostrarData?: boolean
}) {
    const [selecionado, setSelecionado] = useState<string | null>(null)
    // A mesma venda pode vir como vencimento e como entrega (mesmo id): a chave leva a origem.
    const chave = (i: ItemAgenda) => `${i.origem}-${i.id}`
    const atual = itens.find((i) => chave(i) === selecionado)

    if (atual) {
        return (
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={() => setSelecionado(null)}
                    className="-ml-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" /> Voltar
                </button>
                <DetalheItem item={atual} onFechar={onFechar} onCriarRetorno={onCriarRetorno} />
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-base font-semibold text-foreground">{titulo}</p>
                    {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
                </div>
                <button
                    type="button"
                    aria-label="Fechar"
                    onClick={onFechar}
                    className="-mr-2 -mt-1 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <X className="size-4" />
                </button>
            </div>
            <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {itens.map((i) => (
                    <li key={chave(i)}>
                        <ChipBotao item={i} className="py-1.5 text-sm" onClick={() => setSelecionado(chave(i))} />
                        {mostrarData && (
                            <p className="pl-2.5 pt-0.5 text-[11px] text-muted-foreground">
                                {i.data.slice(8, 10)}/{i.data.slice(5, 7)}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    )
}

const IconeVencimentos = ICONE_CAMADA.vencimentos

/** Vários vencimentos no mesmo dia → um chip "N · R$ X" com o ícone da camada (total do banco). */
export function ChipVencimentosAgregado({
    itens, total, onCriarRetorno,
}: { itens: ItemAgenda[]; total: number; onCriarRetorno: CriarRetorno }) {
    const [aberto, setAberto] = useState(false)
    const atrasado = itens.some((i) => i.atrasado)
    return (
        <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={`${itens.length} vencimentos · ${formatCurrency(total)}`}
                    aria-label={`${itens.length} vencimentos · ${formatCurrency(total)}`}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(baseChip, VISUAL_CAMADA.vencimentos.chip, 'font-semibold')}
                >
                    <IconeVencimentos className={cn('size-3 shrink-0', VISUAL_CAMADA.vencimentos.icone)} aria-hidden="true" />
                    {/* Curto para caber em uma linha: '15 · R$ 885'. O tooltip diz "15 vencimentos". */}
                    <span className={cn('truncate tabular-nums', atrasado && 'text-destructive')}>
                        {itens.length} · {valorCurto(total)}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-96" onClick={(e) => e.stopPropagation()}>
                <ListaComDetalhe
                    titulo={`${itens.length} vencimentos`}
                    subtitulo={<span className="font-semibold tabular-nums text-warning-strong">{formatCurrency(total)} em aberto</span>}
                    itens={itens}
                    onFechar={() => setAberto(false)}
                    onCriarRetorno={onCriarRetorno}
                />
            </PopoverContent>
        </Popover>
    )
}

/** "+N mais" → o dia inteiro num popover (Google: a lista do dia). */
export function MaisDoDia({
    mais, chips, rotuloDia, onCriarRetorno,
}: { mais: number; chips: ChipAgenda[]; rotuloDia: string; onCriarRetorno: CriarRetorno }) {
    const [aberto, setAberto] = useState(false)
    const itens = chips.flatMap((c) => (c.tipo === 'item' ? [c.item] : c.itens))
    return (
        <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-md px-1.5 py-[3px] text-left text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    +{mais} mais
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-96" onClick={(e) => e.stopPropagation()}>
                <ListaComDetalhe
                    titulo={rotuloDia}
                    subtitulo={`${itens.length} itens`}
                    itens={itens}
                    onFechar={() => setAberto(false)}
                    onCriarRetorno={onCriarRetorno}
                />
            </PopoverContent>
        </Popover>
    )
}
