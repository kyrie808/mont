import { useState } from 'react'
import { Truck, MapPin, User, CalendarDays } from 'lucide-react'
import type { DomainVenda } from '../../../types/domain'

interface VendaInfoEntregaProps {
    venda: DomainVenda
    /** Remarca a data prevista (null = tira da automação). Resolve true se salvou. */
    onRemarcar?: (data: string | null) => Promise<boolean>
}

function formatarDia(iso: string): string {
    const [ano, mes, dia] = iso.split('-')
    return `${dia}/${mes}/${ano}`
}

function formatarAviso(ts: string): string {
    return new Date(ts).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
}

function formatarEndereco(c: DomainVenda['contato']): string {
    if (!c) return 'Endereço não informado'
    const linha = [c.logradouro, c.numero].filter(Boolean).join(', ')
    const partes = [
        linha || c.endereco,
        c.complemento,
        c.bairro,
        [c.cidade, c.uf].filter(Boolean).join(' - '),
    ].filter(Boolean)
    return partes.join(' · ') || 'Endereço não informado'
}

const STATUS: Record<string, { label: string; cls: string }> = {
    entregue: { label: 'Entregue', cls: 'bg-success/15 text-success' },
    pendente: { label: 'Pendente', cls: 'bg-warning-strong/15 text-warning-strong' },
    cancelada: { label: 'Cancelada', cls: 'bg-destructive/15 text-destructive' },
}

export function VendaInfoEntrega({ venda, onRemarcar }: VendaInfoEntregaProps) {
    const st = STATUS[venda.status] ?? STATUS.pendente
    const atual = venda.dataEntregaPrevista ?? ''
    const [data, setData] = useState(atual)
    const [salvando, setSalvando] = useState(false)
    // Só venda pendente se remarca: entregue/cancelada já saiu da automação.
    const editavel = venda.status === 'pendente' && !!onRemarcar
    const mudou = data !== atual

    const salvar = async () => {
        if (!onRemarcar) return
        setSalvando(true)
        await onRemarcar(data || null)
        setSalvando(false)
    }

    return (
        <div className="bg-card/80 backdrop-blur-md border border-border rounded-xl p-5 shadow-card mb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-medium text-foreground">
                    <Truck className="h-5 w-5 text-primary" /> Entrega
                </h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
            </div>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{venda.entregadorNome ?? 'Entregador não definido'}</span>
                </div>
                <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formatarEndereco(venda.contato)}</span>
                </div>
                <div className="flex items-start gap-2 text-foreground">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-2">
                        {editavel ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    aria-label="Data prevista de entrega"
                                    value={data}
                                    onChange={(e) => setData(e.target.value)}
                                    className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                {mudou && (
                                    <button
                                        type="button"
                                        onClick={salvar}
                                        disabled={salvando}
                                        className="shrink-0 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {salvando ? 'Salvando…' : 'Remarcar'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <span>{atual ? `Prevista para ${formatarDia(atual)}` : 'Sem data prevista'}</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {!atual
                                ? 'Sem data, a venda fica fora do aviso automático no #ENTREGAS.'
                                : venda.avisoGrupoEnviadoEm
                                    ? `Aviso enviado ao #ENTREGAS em ${formatarAviso(venda.avisoGrupoEnviadoEm)}. Remarcar manda um aviso novo.`
                                    : 'Aviso ao #ENTREGAS ainda não enviado.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
