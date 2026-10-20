import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Check, CalendarClock, ExternalLink, MessageCircle, Plus, RotateCcw, ShoppingCart, Trash2, User, X,
} from 'lucide-react'
import { cn, formatCurrency, getWhatsAppLink, hojeBrasilia, type ItemAgenda } from '@mont/shared'
import { useToast } from '../../ui/Toast'
import { useLembreteMutations } from '../../../hooks/useAgenda'
import { camadaDoItem, CAMADAS, horaCurta, mensagemDeErro, NOME_FORMA, NOME_RESPONSAVEL, NOME_TIPO, paraData, rotuloDoItem, somarDias } from '../../../utils/agenda'
import { VISUAL_CAMADA } from './camadasVisual'
import type { PrefillLembrete } from './CriacaoRapida'

interface DetalheItemProps {
    item: ItemAgenda
    onFechar: () => void
    /** Itens de camada: "Criar retorno" abre a criação rápida já preenchida. */
    onCriarRetorno: (prefill: PrefillLembrete) => void
}

/** 'AAAA-MM-DD' → 'Sexta-feira, 13 de novembro'. */
function diaPorExtenso(dia: string): string {
    const t = format(paraData(dia), "EEEE, d 'de' MMMM", { locale: ptBR })
    return t.charAt(0).toUpperCase() + t.slice(1)
}

const botaoIcone =
    'inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const botaoAcao =
    'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

/** O conteúdo do popover de um item (Google: detalhe do evento). */
export function DetalheItem({ item, onFechar, onCriarRetorno }: DetalheItemProps) {
    const navigate = useNavigate()
    const toast = useToast()
    const { concluir, reabrir, reagendar, excluir } = useLembreteMutations()
    const [modo, setModo] = useState<'normal' | 'reagendar' | 'excluir'>('normal')
    const [novaData, setNovaData] = useState(item.data)

    const camada = camadaDoItem(item)
    const nomeCamada = CAMADAS.find((c) => c.id === camada)?.rotulo ?? ''
    const ehLembrete = item.origem === 'lembrete'
    const feito = item.situacao === 'feito'
    const ocupado = concluir.isPending || reabrir.isPending || reagendar.isPending || excluir.isPending

    const executar = async (acao: () => Promise<unknown>, ok: string, erro: string) => {
        try {
            await acao()
            toast.success(ok)
            onFechar()
        } catch (e) {
            toast.error(mensagemDeErro(e, erro))
        }
    }

    const moverPara = (data: string) =>
        executar(() => reagendar.mutateAsync({ id: item.id, data }), 'Lembrete reagendado', 'Não deu para reagendar')

    const abrirRegistro = () => {
        onFechar()
        if (item.origem === 'conta_pagar') navigate('/contas-a-pagar')
        else if (item.origem === 'retomada' && item.contato_id) navigate(`/contatos/${item.contato_id}`)
        else if (item.venda_id) navigate(`/vendas/${item.venda_id}`)
    }

    const criarRetorno = () => {
        onFechar()
        onCriarRetorno({
            data: item.data < hojeBrasilia() ? hojeBrasilia() : item.data,
            tipo: item.origem === 'vencimento' ? 'cobranca' : item.origem === 'retomada' ? 'retorno_comercial' : 'pendencia_interna',
            titulo: item.origem === 'vencimento' ? `Cobrar ${item.contato_nome ?? ''}`.trim() : '',
            contato: item.contato_id && item.contato_nome
                ? { id: item.contato_id, nome: item.contato_nome, telefone: item.contato_telefone ?? '' }
                : null,
            vendaId: item.origem === 'vencimento' || item.origem === 'entrega' ? item.venda_id : null,
        })
    }

    return (
        <div className="space-y-3 text-sm">
            {/* Barra de ações do topo (Google: lixeira, fechar) */}
            <div className="-mr-2 -mt-2 flex items-center justify-end gap-0.5">
                {ehLembrete && (
                    <button type="button" aria-label="Excluir lembrete" className={botaoIcone} onClick={() => setModo('excluir')}>
                        <Trash2 className="size-4" />
                    </button>
                )}
                <button type="button" aria-label="Fechar" className={botaoIcone} onClick={onFechar}>
                    <X className="size-4" />
                </button>
            </div>

            <div className="flex items-start gap-3">
                <span className={cn('mt-1.5 size-3 shrink-0 rounded-sm', VISUAL_CAMADA[camada].ponto)} aria-hidden="true" />
                <div className="min-w-0">
                    <p className={cn('text-lg font-semibold leading-snug text-foreground', feito && 'line-through opacity-60')}>
                        {rotuloDoItem(item)}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                        {diaPorExtenso(item.data)}
                        {item.hora && ` · ${horaCurta(item.hora)}`}
                        {item.atrasado && <span className="ml-1.5 font-semibold text-destructive">· atrasado</span>}
                    </p>
                </div>
            </div>

            <dl className="space-y-1.5 pl-6 text-foreground">
                <div className="flex gap-2">
                    <dt className="text-muted-foreground">Tipo</dt>
                    <dd>{ehLembrete ? (NOME_TIPO[item.tipo ?? ''] ?? item.tipo) : nomeCamada}{feito && ' · feito'}</dd>
                </div>
                {item.responsavel && (
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">Responsável</dt>
                        <dd>{NOME_RESPONSAVEL[item.responsavel] ?? item.responsavel}</dd>
                    </div>
                )}
                {item.contato_nome && (
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">Cliente</dt>
                        <dd className="truncate">{item.contato_nome}</dd>
                    </div>
                )}
                {item.forma_pagamento && (
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">Venda</dt>
                        <dd>{NOME_FORMA[item.forma_pagamento] ?? item.forma_pagamento}</dd>
                    </div>
                )}
                {item.valor !== null && (
                    <div className="flex gap-2">
                        <dt className="text-muted-foreground">{item.origem === 'conta_pagar' ? 'A pagar' : 'Em aberto'}</dt>
                        <dd className={cn('font-semibold tabular-nums', item.origem === 'conta_pagar' ? 'text-destructive' : 'text-warning-strong')}>
                            {formatCurrency(item.valor)}
                        </dd>
                    </div>
                )}
                {item.descricao && <p className="whitespace-pre-line pt-1 text-muted-foreground">{item.descricao}</p>}
            </dl>

            {modo === 'excluir' && (
                <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                    <p className="font-medium text-foreground">Excluir este lembrete?</p>
                    <div className="flex justify-end gap-2">
                        <button type="button" className={botaoAcao} onClick={() => setModo('normal')} disabled={ocupado}>Cancelar</button>
                        <button
                            type="button"
                            className={cn(botaoAcao, 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90')}
                            disabled={ocupado}
                            onClick={() => executar(() => excluir.mutateAsync(item.id), 'Lembrete excluído', 'Não deu para excluir')}
                        >
                            Excluir
                        </button>
                    </div>
                </div>
            )}

            {modo === 'reagendar' && (
                <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={botaoAcao} disabled={ocupado} onClick={() => moverPara(somarDias(item.data, 1))}>+1 dia</button>
                        <button type="button" className={botaoAcao} disabled={ocupado} onClick={() => moverPara(somarDias(item.data, 7))}>+7 dias</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            aria-label="Nova data"
                            value={novaData}
                            onChange={(e) => setNovaData(e.target.value)}
                            className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <button
                            type="button"
                            className={cn(botaoAcao, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90')}
                            disabled={ocupado || !novaData || novaData === item.data}
                            onClick={() => moverPara(novaData)}
                        >
                            Mover
                        </button>
                    </div>
                </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {ehLembrete ? (
                    <>
                        {feito ? (
                            <button type="button" className={botaoAcao} disabled={ocupado}
                                onClick={() => executar(() => reabrir.mutateAsync(item.id), 'Lembrete reaberto', 'Não deu para reabrir')}>
                                <RotateCcw className="size-3.5" /> Reabrir
                            </button>
                        ) : (
                            <>
                                <button type="button" className={cn(botaoAcao, 'border-primary bg-primary text-primary-foreground hover:bg-primary/90')} disabled={ocupado}
                                    onClick={() => executar(() => concluir.mutateAsync(item.id), 'Marcado como feito', 'Não deu para marcar como feito')}>
                                    <Check className="size-3.5" /> Marcar como feito
                                </button>
                                <button type="button" className={botaoAcao} aria-expanded={modo === 'reagendar'}
                                    onClick={() => setModo(modo === 'reagendar' ? 'normal' : 'reagendar')}>
                                    <CalendarClock className="size-3.5" /> Reagendar
                                </button>
                            </>
                        )}
                        {item.venda_id && (
                            <button type="button" className={botaoAcao} onClick={() => { onFechar(); navigate(`/vendas/${item.venda_id}`) }}>
                                <ShoppingCart className="size-3.5" /> Abrir venda
                            </button>
                        )}
                        {item.contato_id && (
                            <button type="button" className={botaoAcao} onClick={() => { onFechar(); navigate(`/contatos/${item.contato_id}`) }}>
                                <User className="size-3.5" /> Abrir cliente
                            </button>
                        )}
                        {item.contato_telefone && (
                            <a href={getWhatsAppLink(item.contato_telefone)} target="_blank" rel="noopener noreferrer" className={botaoAcao}>
                                <MessageCircle className="size-3.5" /> WhatsApp
                            </a>
                        )}
                    </>
                ) : (
                    <>
                        <button type="button" className={botaoAcao} onClick={abrirRegistro}>
                            <ExternalLink className="size-3.5" /> Abrir registro
                        </button>
                        <button type="button" className={botaoAcao} onClick={criarRetorno}>
                            <Plus className="size-3.5" /> Criar retorno
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
