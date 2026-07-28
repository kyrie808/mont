import { useNavigate } from 'react-router-dom'
import { RefreshCw, MessageCircle, BellOff, ChevronRight, Snowflake } from 'lucide-react'
import { Drawer } from '../ui/Drawer'
import { formatCurrency, formatPhone, cn } from '@mont/shared'
import type { AlertaContaAPagar, StatusVencimento } from '@/hooks/useAlertasContasAPagar'
import type { ClienteEsfriando } from '@/hooks/useClientesEsfriando'
import type { RawFinanceiroAlerta } from '@/services/dashboardService'

interface NotificationPanelProps {
    isOpen: boolean
    onClose: () => void
    aPagar: AlertaContaAPagar[]
    aReceber: RawFinanceiroAlerta[]
    esfriando: ClienteEsfriando[]
    /** Template de recompra (Configurações) p/ o botão "Contatar". */
    mensagemRecompra?: string
    onRefresh: () => void
    refreshing?: boolean
}

// Severidade → token (DESIGN_SYSTEM §5). Traço fino, não borda de card.
const RAIL: Record<StatusVencimento, string> = {
    vencido: 'bg-destructive',
    hoje: 'bg-warning-strong',
    a_vencer: 'bg-warning',
}
const TXT: Record<StatusVencimento, string> = {
    vencido: 'text-destructive',
    hoje: 'text-warning-strong',
    a_vencer: 'text-warning',
}

function labelVencimento(a: AlertaContaAPagar): string {
    if (a.status === 'vencido') return `venceu há ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`
    if (a.status === 'hoje') return 'vence hoje'
    return `vence em ${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`
}

function ResumoCell({ label, valor, valueClass }: { label: string; valor: number; valueClass: string }) {
    return (
        <div className="min-w-0 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn('mt-0.5 text-sm font-black tabular-nums truncate', valueClass)}>{formatCurrency(valor)}</p>
        </div>
    )
}

const MENSAGEM_RECOMPRA_FALLBACK = 'Oi {{nome}}! Faz {{dias}} dias que você não compra com a gente 🧀 Bora repor o pão de queijo?'

export function NotificationPanel({ isOpen, onClose, aPagar, aReceber, esfriando, mensagemRecompra, onRefresh, refreshing }: NotificationPanelProps) {
    const navigate = useNavigate()
    const total = aPagar.length + aReceber.length + esfriando.length

    const totalVencido = aPagar.filter(a => a.status === 'vencido').reduce((s, a) => s + a.valor, 0)
    const totalAVencer = aPagar.filter(a => a.status !== 'vencido').reduce((s, a) => s + a.valor, 0)
    const totalReceber = aReceber.reduce((s, r) => s + r.valor, 0)

    const irParaDespesas = () => {
        onClose()
        navigate('/contas-a-pagar')
    }

    const cobrar = (telefone: string, nome: string, valor: number) => {
        const msg = `Olá ${nome}, tudo bem? Estou entrando em contato referente ao valor de ${formatCurrency(valor)} que está em aberto.`
        window.open(`https://wa.me/55${formatPhone(telefone).replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    const diasAtrasoReceber = (vencimento: string) =>
        Math.max(0, Math.floor((Date.now() - new Date(vencimento).getTime()) / 86400000))

    const irParaPerfil = (contatoId: string) => {
        onClose()
        navigate(`/contatos/${contatoId}`)
    }

    // "Contatar" um cliente esfriando: usa a Mensagem de Recompra configurada (interpola nome/dias).
    const contatar = (c: ClienteEsfriando) => {
        const template = (mensagemRecompra?.trim() || MENSAGEM_RECOMPRA_FALLBACK)
        const msg = template
            .replace(/\{\{nome\}\}/g, c.nome.split(' ')[0])
            .replace(/\{\{dias\}\}/g, String(c.dias_sem_compra))
        const fone = (c.telefone ?? '').replace(/\D/g, '')
        if (fone) window.open(`https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`, '_blank')
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Notificações"
            subtitle="Vencimentos e cobranças"
        >
            {total === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                    <BellOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-foreground">Tudo em dia</p>
                    <p className="mt-1 text-xs text-muted-foreground">Nenhuma conta a pagar ou receber pedindo atenção.</p>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} />
                        Atualizar
                    </button>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Faixa-resumo — o glance de saúde */}
                    <div className="px-4 pt-4">
                        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-foreground/[0.04]">
                            <ResumoCell label="Vencido" valor={totalVencido} valueClass="text-destructive" />
                            <ResumoCell label="A vencer" valor={totalAVencer} valueClass="text-foreground" />
                            <ResumoCell label="A receber" valor={totalReceber} valueClass="text-warning-strong" />
                        </div>
                    </div>

                    <div className="flex justify-end px-4 pt-2">
                        <button
                            type="button"
                            onClick={onRefresh}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin motion-reduce:animate-none')} />
                            Atualizar
                        </button>
                    </div>

                    {/* Contas a pagar */}
                    {aPagar.length > 0 && (
                        <section className="mt-2">
                            <h3 className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Contas a pagar
                            </h3>
                            <div className="divide-y divide-border border-y border-border">
                                {aPagar.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={irParaDespesas}
                                        className="relative flex w-full items-start gap-3 py-3 pl-5 pr-3 text-left transition-colors hover:bg-muted"
                                    >
                                        <span aria-hidden className={cn('absolute left-2 top-3 bottom-3 w-0.5 rounded-full', RAIL[a.status])} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{a.descricao}</p>
                                                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatCurrency(a.valor)}</span>
                                            </div>
                                            <div className="mt-0.5 flex items-center justify-between gap-2">
                                                <span className="min-w-0 truncate text-xs">
                                                    <span className="text-muted-foreground">{a.credor}</span>
                                                    <span className="text-muted-foreground/50"> · </span>
                                                    <span className={TXT[a.status]}>{labelVencimento(a)}</span>
                                                </span>
                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Contas a receber (recebíveis atrasados) */}
                    {aReceber.length > 0 && (
                        <section className="mt-2 pb-4">
                            <h3 className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Contas a receber
                            </h3>
                            <div className="divide-y divide-border border-y border-border">
                                {aReceber.map((r) => (
                                    <div key={r.venda_id} className="relative flex items-start gap-3 py-3 pl-5 pr-3">
                                        <span aria-hidden className="absolute left-2 top-3 bottom-3 w-0.5 rounded-full bg-warning-strong" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{r.contato_nome || 'Cliente'}</p>
                                                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{formatCurrency(r.valor)}</span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between gap-2">
                                                <span className="text-xs text-warning-strong">
                                                    {diasAtrasoReceber(r.vencimento)} dias de atraso
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => cobrar(r.contato_telefone || '', r.contato_nome || '', r.valor)}
                                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success transition-colors hover:bg-success/20"
                                                >
                                                    <MessageCircle className="h-3.5 w-3.5" /> Cobrar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Clientes esfriando (bom recorrente que ficou frio, ainda salvável) */}
                    {esfriando.length > 0 && (
                        <section className="mt-2 pb-4">
                            <h3 className="px-4 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Clientes esfriando
                            </h3>
                            <div className="divide-y divide-border border-y border-border">
                                {esfriando.map((c) => (
                                    <div key={c.contato_id} className="relative flex items-start gap-3 py-3 pl-5 pr-3">
                                        <span aria-hidden className="absolute left-2 top-3 bottom-3 w-0.5 rounded-full bg-warning" />
                                        <button
                                            type="button"
                                            onClick={() => irParaPerfil(c.contato_id)}
                                            className="min-w-0 flex-1 text-left"
                                        >
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{c.nome}</p>
                                                <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
                                                    <Snowflake className="h-3.5 w-3.5 text-warning-strong" />
                                                    {c.total_pedidos} compras
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-xs text-warning-strong">
                                                {c.dias_sem_compra}d sem comprar
                                                {c.intervalo_medio ? ` · ritmo ~${Math.round(c.intervalo_medio)}d` : ''}
                                            </p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => contatar(c)}
                                            className="inline-flex shrink-0 items-center gap-1.5 self-center rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success transition-colors hover:bg-success/20"
                                        >
                                            <MessageCircle className="h-3.5 w-3.5" /> Contatar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </Drawer>
    )
}
