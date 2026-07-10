import { MapPin, Phone, Truck, Banknote, Check, Loader2 } from 'lucide-react'
import type { Entrega } from '../services/entregasService'

interface EntregaCardProps {
    entrega: Entrega
    onRecebido: (vendaId: string) => void
    onEntregue: (vendaId: string) => void
    processando: boolean
}

function formatarEndereco(e: Entrega): string {
    const linha = [e.logradouro, e.numero].filter(Boolean).join(', ')
    const partes = [
        linha || e.endereco,
        e.complemento,
        e.bairro,
        [e.cidade, e.uf].filter(Boolean).join(' - '),
    ].filter(Boolean)
    return partes.join(' · ') || 'Endereço não informado'
}

const moeda = (v: number | null) =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function EntregaCard({ entrega, onRecebido, onEntregue, processando }: EntregaCardProps) {
    const entregue = entrega.status_entrega === 'entregue'
    const recebeNaEntrega = entrega.estado_pagamento === 'receber_na_entrega'
    const jaRecebido = Boolean(entrega.recebido_em)
    const telefone = entrega.cliente_telefone?.replace(/\D/g, '')

    return (
        <div className={`rounded-2xl border bg-white p-4 shadow-sm ${entregue ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">
                        {entrega.cliente_apelido || entrega.cliente_nome}
                    </p>
                    <p className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span>{formatarEndereco(entrega)}</span>
                    </p>
                </div>
                {entregue ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                        Entregue
                    </span>
                ) : recebeNaEntrega ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                        Receber
                    </span>
                ) : (
                    <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                        Só entregar
                    </span>
                )}
            </div>

            {/* Frete + repasse */}
            <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-slate-700">
                    <Truck className="h-4 w-4 text-slate-400" />
                    Frete {moeda(entrega.taxa_entrega)}
                </span>
                <span className="text-slate-500">Repasse {moeda(entrega.repasse)}</span>
            </div>

            {recebeNaEntrega && !jaRecebido && (
                <p className="mt-2 text-sm font-semibold text-amber-700">
                    Receber {moeda(entrega.taxa_entrega)} em dinheiro na entrega.
                </p>
            )}
            {jaRecebido && (
                <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    <Check className="h-4 w-4" /> Dinheiro recebido
                </p>
            )}

            {entrega.observacao_entregador && (
                <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {entrega.observacao_entregador}
                </div>
            )}

            {/* Ações */}
            <div className="mt-4 flex flex-wrap gap-2">
                {telefone && (
                    <a
                        href={`tel:${telefone}`}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 active:scale-95"
                    >
                        <Phone className="h-4 w-4" /> Ligar
                    </a>
                )}
                {!entregue && recebeNaEntrega && !jaRecebido && (
                    <button
                        type="button"
                        disabled={processando}
                        onClick={() => onRecebido(entrega.venda_id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
                    >
                        {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
                        Recebi o dinheiro
                    </button>
                )}
                {!entregue && (
                    <button
                        type="button"
                        disabled={processando}
                        onClick={() => onEntregue(entrega.venda_id)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white active:scale-95 disabled:opacity-60"
                    >
                        {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Marcar entregue
                    </button>
                )}
            </div>
        </div>
    )
}
