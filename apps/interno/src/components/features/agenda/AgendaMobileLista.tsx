import { useNavigate } from 'react-router-dom'
import { cn, formatCurrency, type ItemAgenda } from '@mont/shared'
import { useAgendaAtrasados, useAgendaItens } from '../../../hooks/useAgenda'
import { camadaDoItem, horaCurta, rotuloDoItem, somarDias } from '../../../utils/agenda'
import { VISUAL_CAMADA } from './camadasVisual'

// Celular (<lg), provisório até a Onda 4: lista simples com os mesmos dados da tela do mês
// (agenda_atrasados + agenda_itens de hoje a 7 dias). Tocar abre o registro original.

function destino(item: ItemAgenda): string | null {
    if (item.venda_id) return `/vendas/${item.venda_id}`
    if (item.origem === 'conta_pagar') return '/contas-a-pagar'
    if (item.contato_id) return `/contatos/${item.contato_id}`
    return null
}

function Linha({ item, mostrarData }: { item: ItemAgenda; mostrarData?: boolean }) {
    const navigate = useNavigate()
    const para = destino(item)
    return (
        <li>
            <button
                type="button"
                disabled={!para}
                onClick={() => para && navigate(para)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
            >
                <span className={cn('size-2.5 shrink-0 rounded-full', VISUAL_CAMADA[camadaDoItem(item)].ponto)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm font-medium text-foreground', item.situacao === 'feito' && 'line-through opacity-60')}>
                        {rotuloDoItem(item)}
                    </span>
                    {(mostrarData || item.hora) && (
                        <span className="block text-xs text-muted-foreground">
                            {mostrarData && `${item.data.slice(8, 10)}/${item.data.slice(5, 7)}`}
                            {mostrarData && item.hora && ' · '}
                            {horaCurta(item.hora)}
                        </span>
                    )}
                </span>
                {item.valor !== null && item.origem !== 'retomada' && (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(item.valor)}</span>
                )}
            </button>
        </li>
    )
}

function Secao({ titulo, itens, mostrarData, vazio }: { titulo: string; itens: ItemAgenda[]; mostrarData?: boolean; vazio: string }) {
    return (
        <section className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {titulo} <span className="tabular-nums">({itens.length})</span>
            </h2>
            {itens.length === 0 ? (
                <p className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{vazio}</p>
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    {itens.map((i) => <Linha key={`${i.origem}-${i.id}`} item={i} mostrarData={mostrarData} />)}
                </ul>
            )}
        </section>
    )
}

export function AgendaMobileLista({ hoje }: { hoje: string }) {
    const { data: itens = [], isLoading } = useAgendaItens(hoje, somarDias(hoje, 7))
    const { data: atrasados = [] } = useAgendaAtrasados()

    if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>

    const ativos = itens.filter((i) => i.situacao !== 'feito')
    return (
        <div className="space-y-6 py-4">
            <Secao titulo="Atrasados" itens={atrasados} mostrarData vazio="Nada atrasado." />
            <Secao titulo="Hoje" itens={ativos.filter((i) => i.data === hoje)} vazio="Nada marcado para hoje." />
            <Secao titulo="Próximos 7 dias" itens={ativos.filter((i) => i.data > hoje)} mostrarData vazio="Nada nos próximos dias." />
        </div>
    )
}
