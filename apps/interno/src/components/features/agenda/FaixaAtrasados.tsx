import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarX2 } from 'lucide-react'
import { cn, formatCurrency, type ItemAgenda, type ItemSemData } from '@mont/shared'
import { Drawer, Popover, PopoverContent, PopoverTrigger } from '../../ui'
import { NOME_FORMA, quebraPorForma, resumirAtrasados } from '../../../utils/agenda'
import { ListaComDetalhe } from './ChipsAgenda'
import type { PrefillLembrete } from './CriacaoRapida'

interface FaixaAtrasadosProps {
    atrasados: ItemAgenda[]
    semData: ItemSemData[]
    onCriarRetorno: (prefill: PrefillLembrete) => void
}

const pilula =
    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Grupo de atrasados (lembretes ou vencimentos) que abre a lista num popover. */
function GrupoAtrasado({ rotulo, itens, valor, onCriarRetorno }: {
    rotulo: string; itens: ItemAgenda[]; valor: number; onCriarRetorno: FaixaAtrasadosProps['onCriarRetorno']
}) {
    const [aberto, setAberto] = useState(false)
    if (itens.length === 0) return null
    return (
        <Popover open={aberto} onOpenChange={setAberto}>
            <PopoverTrigger asChild>
                <button type="button" className={cn(pilula, 'border-destructive/30 bg-destructive/10 text-foreground hover:bg-destructive/15')}>
                    <span className="font-semibold tabular-nums text-destructive">{itens.length}</span>
                    {rotulo}
                    {valor > 0 && <span className="tabular-nums text-muted-foreground">· {formatCurrency(valor)}</span>}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
                <ListaComDetalhe
                    titulo={`${itens.length} ${rotulo} atrasados`}
                    subtitulo={valor > 0 ? <span className="font-semibold tabular-nums text-destructive">{formatCurrency(valor)}</span> : undefined}
                    itens={itens}
                    mostrarData
                    onFechar={() => setAberto(false)}
                    onCriarRetorno={onCriarRetorno}
                />
            </PopoverContent>
        </Popover>
    )
}

/** Faixa acima da grade: o que já passou do dia (dois grupos) e o que nem data tem. */
export function FaixaAtrasados({ atrasados, semData, onCriarRetorno }: FaixaAtrasadosProps) {
    const navigate = useNavigate()
    const [semDataAberto, setSemDataAberto] = useState(false)
    const r = resumirAtrasados(atrasados)
    const totalSemData = semData.reduce((acc, i) => acc + i.valor, 0)
    const quebra = quebraPorForma(semData)
    const nada = r.lembretes.length === 0 && r.vencimentos.length === 0

    return (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3">
            <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', nada ? 'text-muted-foreground' : 'text-destructive')}>
                <AlertTriangle className="size-4" />
                {nada ? 'Nada atrasado' : 'Atrasados'}
            </span>
            <GrupoAtrasado rotulo="lembretes" itens={r.lembretes} valor={r.valorLembretes} onCriarRetorno={onCriarRetorno} />
            <GrupoAtrasado rotulo="vencimentos" itens={r.vencimentos} valor={r.valorVencimentos} onCriarRetorno={onCriarRetorno} />

            {semData.length > 0 && (
                <button
                    type="button"
                    onClick={() => setSemDataAberto(true)}
                    className={cn(pilula, 'ml-auto border-border text-foreground hover:bg-muted')}
                >
                    <CalendarX2 className="size-4 text-warning-strong" />
                    <span className="font-semibold tabular-nums">{semData.length}</span> em aberto sem data
                    <span className="tabular-nums text-muted-foreground">· {formatCurrency(totalSemData)}</span>
                </button>
            )}

            <Drawer
                isOpen={semDataAberto}
                onClose={() => setSemDataAberto(false)}
                title={`${semData.length} em aberto sem data`}
                subtitle={`${formatCurrency(totalSemData)} sem previsão de pagamento`}
            >
                <div className="space-y-4 p-4">
                    <div className="flex flex-wrap gap-2">
                        {quebra.map((q) => (
                            <span key={q.forma} className="rounded-full bg-muted px-3 py-1 text-xs text-foreground">
                                {NOME_FORMA[q.forma] ?? q.forma}: <span className="font-semibold tabular-nums">{q.quantidade}</span>
                                <span className="tabular-nums text-muted-foreground"> · {formatCurrency(q.valor)}</span>
                            </span>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Abra a venda e preencha a previsão de pagamento — ela passa a aparecer no dia certo da agenda.
                    </p>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                        {semData.map((v) => (
                            <li key={v.venda_id}>
                                <button
                                    type="button"
                                    onClick={() => { setSemDataAberto(false); navigate(`/vendas/${v.venda_id}`) }}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-foreground">{v.contato_nome}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {NOME_FORMA[v.forma_pagamento] ?? v.forma_pagamento} · venda de {v.data_venda.slice(8, 10)}/{v.data_venda.slice(5, 7)} · há {v.dias_em_aberto} dias
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums text-warning-strong">{formatCurrency(v.valor)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </Drawer>
        </div>
    )
}
