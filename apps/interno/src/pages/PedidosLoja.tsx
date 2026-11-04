import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Store } from 'lucide-react'
import { formatCurrency } from '@mont/shared'
import { Header } from '../components/layout/Header'
import { PageContainer } from '../components/layout/PageContainer'
import { ConfirmDialog, useToast } from '../components/ui'
import { PedidoLojaCard } from '../components/features/pedidos-loja/PedidoLojaCard'
import { ConfirmarPedidoDrawer } from '../components/features/pedidos-loja/ConfirmarPedidoDrawer'
import { useConfirmarPedidoLoja, useDescartarPedidoLoja, usePedidosLoja } from '../hooks/usePedidosLoja'
import { useNomesProdutos } from '../hooks/useProdutos'
import type { PedidoLoja } from '../services/pedidosLojaService'
import { contatoService } from '../services/contatoService'
import { DIAS_NA_LISTA_PRINCIPAL, separarPorIdade } from '../utils/pedidosLoja'

/** "Quem indicou" na confirmação: a mesma busca de clientes do cadastro. */
const buscarIndicadores = (termo: string) => contatoService.func(termo)

function mensagemDeErro(err: unknown): string {
    return err instanceof Error && err.message ? err.message : 'Não foi possível concluir. Tente de novo.'
}

/**
 * Pedidos da loja (02/11/2026): o cliente monta o pedido na loja e manda pelo WhatsApp; aqui o
 * Gilmar confirma (frete, entrega, pagamento) e o pedido vira venda. Sem confirmar, não é venda.
 */
export function PedidosLoja() {
    const toast = useToast()
    const { data: pedidos = [], isLoading, error } = usePedidosLoja()
    const confirmarMut = useConfirmarPedidoLoja()
    const descartarMut = useDescartarPedidoLoja()

    const [confirmando, setConfirmando] = useState<PedidoLoja | null>(null)
    const [descartando, setDescartando] = useState<PedidoLoja | null>(null)
    const [verAntigos, setVerAntigos] = useState(false)

    const { recentes, antigos } = useMemo(() => separarPorIdade(pedidos), [pedidos])
    const comboIds = useMemo(
        () => pedidos.flatMap((p) => p.itens.map((i) => i.comboId)).filter((id): id is string => id !== null),
        [pedidos],
    )
    const nomes = useNomesProdutos(comboIds)

    const cartao = (p: PedidoLoja) => (
        <PedidoLojaCard
            key={p.id}
            pedido={p}
            nomes={nomes}
            onConfirmar={() => setConfirmando(p)}
            onDescartar={() => setDescartando(p)}
        />
    )

    return (
        <>
            <Header title="Pedidos da loja" showBack centerTitle />
            <PageContainer className="pb-24">
                <div className="mx-auto max-w-xl space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-16 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
                            Não foi possível carregar os pedidos. {mensagemDeErro(error)}
                        </div>
                    ) : (
                        <>
                            {recentes.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-10 text-center">
                                    <Store className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Nenhum pedido da loja esperando confirmação.</p>
                                </div>
                            ) : (
                                recentes.map(cartao)
                            )}

                            {antigos.length > 0 && (
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        aria-expanded={verAntigos}
                                        onClick={() => setVerAntigos((v) => !v)}
                                        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span>
                                            Mais antigos ({antigos.length})
                                            <span className="block text-xs font-normal text-muted-foreground">
                                                Parados há mais de {DIAS_NA_LISTA_PRINCIPAL} dias
                                            </span>
                                        </span>
                                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${verAntigos ? 'rotate-180' : ''}`} />
                                    </button>
                                    {verAntigos && <div className="mt-3 space-y-3">{antigos.map(cartao)}</div>}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </PageContainer>

            <ConfirmarPedidoDrawer
                pedido={confirmando}
                confirmando={confirmarMut.isPending}
                buscarContatos={buscarIndicadores}
                onClose={() => { if (!confirmarMut.isPending) setConfirmando(null) }}
                onConfirmar={(dados) => {
                    if (!confirmando || confirmarMut.isPending) return
                    const pedido = confirmando
                    confirmarMut.mutate(
                        { pedidoId: pedido.id, dados },
                        {
                            onSuccess: ({ total }) => {
                                toast.success(`Pedido #${pedido.numero} confirmado: venda de ${formatCurrency(total)}.`)
                                setConfirmando(null)
                            },
                            onError: (err) => toast.error(mensagemDeErro(err)),
                        },
                    )
                }}
            />

            <ConfirmDialog
                open={descartando !== null}
                title={descartando ? `Descartar o pedido #${descartando.numero}?` : ''}
                message="Use quando o cliente não confirmou. O pedido sai da lista e não vira venda."
                confirmLabel="Descartar"
                variant="danger"
                isLoading={descartarMut.isPending}
                onCancel={() => setDescartando(null)}
                onConfirm={() => {
                    if (!descartando) return
                    const pedido = descartando
                    descartarMut.mutate(pedido.id, {
                        onSuccess: () => {
                            toast.success(`Pedido #${pedido.numero} descartado.`)
                            setDescartando(null)
                        },
                        onError: (err) => toast.error(mensagemDeErro(err)),
                    })
                }}
            />
        </>
    )
}
