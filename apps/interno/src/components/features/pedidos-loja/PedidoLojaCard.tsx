import { MessageCircle } from 'lucide-react'
import { formatCurrency } from '@mont/shared'
import { Button } from '../../ui'
import type { FormaPagamentoLoja, PedidoLoja } from '../../../services/pedidosLojaService'
import { agruparItens, quandoSP } from '../../../utils/pedidosLoja'

const ROTULO_PAGAMENTO: Record<FormaPagamentoLoja, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }

interface PedidoLojaCardProps {
    pedido: PedidoLoja
    /** Nome de cada combo (itens guardam o combo só pelo id). */
    nomes: Map<string, string>
    onConfirmar: () => void
    onDescartar: () => void
}

/** Um pedido da loja esperando confirmação: quem, onde, o quê e quanto (no Pix, sem frete). */
export function PedidoLojaCard({ pedido, nomes, onConfirmar, onDescartar }: PedidoLojaCardProps) {
    const linhas = agruparItens(pedido.itens)

    return (
        <article className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground tabular-nums">
                        #{pedido.numero} · {quandoSP(pedido.criadoEm)}
                    </p>
                    <h3 className="truncate text-base font-bold text-foreground">{pedido.nome}</h3>
                    <p className="text-xs text-muted-foreground">
                        {pedido.cadastro ? `Já é cliente: ${pedido.cadastro.nome}` : 'Cliente novo'}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(pedido.total)}</p>
                    <p className="text-[11px] text-muted-foreground">no Pix, sem frete</p>
                </div>
            </div>

            <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm text-foreground">
                {linhas.map((l) =>
                    l.tipo === 'produto' ? (
                        <li key={l.chave} className="flex justify-between gap-3">
                            <span>{l.quantidade > 1 ? `${l.quantidade}× ` : ''}{l.nome}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(l.total)}</span>
                        </li>
                    ) : (
                        <li key={l.chave}>
                            <div className="flex justify-between gap-3 font-medium">
                                <span>{nomes.get(l.comboId) ?? 'Combo'}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{formatCurrency(l.total)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {l.itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ''}${i.nome}`).join(' · ')}
                            </p>
                        </li>
                    ),
                )}
            </ul>

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                {pedido.entrega === 'retirada' ? (
                    <p className="font-semibold text-foreground">Retirada na Mont</p>
                ) : (
                    <>
                        <p>{pedido.endereco}</p>
                        <p>
                            {pedido.freteEstimado !== null
                                ? `Frete estimado pelo CEP: ${formatCurrency(pedido.freteEstimado)}`
                                : 'Frete a combinar'}
                        </p>
                    </>
                )}
                {pedido.pagamentoPreferido && <p>Prefere pagar: {ROTULO_PAGAMENTO[pedido.pagamentoPreferido]}</p>}
                {pedido.indicadoPor && <p>Indicado por: {pedido.indicadoPor}</p>}
            </div>

            <div className="mt-3 flex items-center gap-2">
                <a
                    href={`https://wa.me/55${pedido.telefone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir o WhatsApp de ${pedido.nome}`}
                    className="touch-target flex items-center justify-center rounded-xl border border-border text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <MessageCircle className="h-5 w-5" />
                </a>
                <Button variant="ghost" className="text-destructive" onClick={onDescartar}>
                    Descartar
                </Button>
                <Button className="ml-auto flex-1" onClick={onConfirmar}>
                    Confirmar pedido
                </Button>
            </div>
        </article>
    )
}
