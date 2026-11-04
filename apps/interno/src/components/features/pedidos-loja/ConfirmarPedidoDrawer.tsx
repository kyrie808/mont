import { useEffect, useState, type ReactNode } from 'react'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import { Button, Drawer } from '../../ui'
import { FormIndicacao } from '../contatos/form/FormIndicacao'
import type { DomainContato, IndicadorRef } from '../../../types/domain'
import type { ConfirmarPedidoLoja, FormaPagamentoLoja, PedidoLoja } from '../../../services/pedidosLojaService'
import { diaMes, enderecoDiferente, hojeSP, somarDias } from '../../../utils/pedidosLoja'

const FRETES = [0, 5, 10, 15] as const
const FORMAS: { valor: FormaPagamentoLoja; rotulo: string }[] = [
    { valor: 'pix', rotulo: 'Pix' },
    { valor: 'dinheiro', rotulo: 'Dinheiro' },
    { valor: 'cartao', rotulo: 'Cartão' },
]

const inputBase =
    'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-foreground ' +
    'placeholder:text-muted-foreground/60 ring-offset-background ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

interface ConfirmarPedidoDrawerProps {
    pedido: PedidoLoja | null
    confirmando: boolean
    onClose: () => void
    onConfirmar: (dados: ConfirmarPedidoLoja) => void
    /** Busca de clientes para "Quem indicou" (a mesma do cadastro de cliente). */
    buscarContatos: (termo: string) => Promise<DomainContato[]>
}

/** Frete, data de entrega e forma de pagamento em toques; o pedido vira venda pendente. */
export function ConfirmarPedidoDrawer({ pedido, ...resto }: ConfirmarPedidoDrawerProps) {
    if (!pedido) return null
    // A chave reinicia o formulário a cada pedido aberto.
    return <Formulario key={pedido.id} pedido={pedido} {...resto} />
}

/** Frete que já vem marcado: a estimativa pelo CEP. "A combinar" (ou retirada) não marca nada. */
function freteInicial(pedido: PedidoLoja): { frete: number | 'outro' | null; outro: string } {
    const estimado = pedido.entrega === 'entrega' ? pedido.freteEstimado : null
    if (estimado === null) return { frete: null, outro: '' }
    return (FRETES as readonly number[]).includes(estimado)
        ? { frete: estimado, outro: '' }
        : { frete: 'outro', outro: String(estimado).replace('.', ',') }
}

function Formulario({
    pedido,
    confirmando,
    onClose,
    onConfirmar,
    buscarContatos,
}: Omit<ConfirmarPedidoDrawerProps, 'pedido'> & { pedido: PedidoLoja }) {
    const hoje = hojeSP()
    const amanha = somarDias(hoje, 1)
    const retirada = pedido.entrega === 'retirada'
    const inicial = freteInicial(pedido)

    const [frete, setFrete] = useState<number | 'outro' | null>(inicial.frete)
    const [freteOutro, setFreteOutro] = useState(inicial.outro)
    const [data, setData] = useState<string | null>(null)
    const [dataOutra, setDataOutra] = useState(false)
    const [forma, setForma] = useState<FormaPagamentoLoja | null>(pedido.pagamentoPreferido)
    const [atualizarEndereco, setAtualizarEndereco] = useState(false)

    // "Quem indicou" (Ranking): começa pela busca com o que o cliente escreveu.
    const indicadorAtual = pedido.cadastro?.indicador ?? null
    const [indicador, setIndicador] = useState<IndicadorRef | null>(null)
    const [busca, setBusca] = useState(pedido.indicadoPor ?? '')
    const [resultados, setResultados] = useState<DomainContato[]>([])
    const buscando = !indicadorAtual && !indicador && busca.trim().length >= 2
    const sugestoes = buscando ? resultados : []
    useEffect(() => {
        if (!buscando) return
        let vivo = true
        const espera = setTimeout(() => {
            buscarContatos(busca.trim())
                .then((r) => {
                    if (vivo) setResultados(r.filter((c) => c.id !== pedido.cadastro?.id))
                })
                .catch(() => {
                    if (vivo) setResultados([])
                })
        }, 300)
        return () => {
            vivo = false
            clearTimeout(espera)
        }
    }, [buscando, busca, buscarContatos, pedido.cadastro?.id])

    const freteValor = retirada ? 0 : frete === 'outro' ? Number(freteOutro.replace(',', '.')) : frete
    const freteOk = freteValor !== null && Number.isFinite(freteValor) && freteValor >= 0 && freteValor <= 500
    const pronto = freteOk && data !== null && forma !== null
    const perguntaEndereco =
        !retirada &&
        enderecoDiferente(
            { logradouro: pedido.logradouro, numero: pedido.numeroEndereco },
            pedido.cadastro ? { logradouro: pedido.cadastro.logradouro, numero: pedido.cadastro.numero } : null,
        )

    const confirmar = () => {
        if (!pronto || freteValor === null || data === null || forma === null || confirmando) return
        onConfirmar({
            frete: freteValor,
            dataEntrega: data,
            forma,
            atualizarEndereco: perguntaEndereco && atualizarEndereco,
            indicadoPorId: indicador?.id ?? null,
        })
    }

    return (
        <Drawer
            isOpen
            onClose={onClose}
            title={`Confirmar pedido #${pedido.numero}`}
            subtitle={`${pedido.nome} · ${formatCurrency(pedido.total)} no Pix`}
            footer={
                <Button className="w-full" size="lg" disabled={!pronto} isLoading={confirmando} onClick={confirmar}>
                    {pronto && forma !== 'cartao' && freteValor !== null
                        ? `Confirmar · ${formatCurrency(pedido.total + freteValor)}`
                        : 'Confirmar pedido'}
                </Button>
            }
        >
            <div className="space-y-6 p-4">
                {retirada ? (
                    <section className="rounded-xl border border-border bg-muted p-3 text-sm text-foreground">
                        <p className="font-medium">Retirada na Mont</p>
                        <p className="text-xs text-muted-foreground">Sem frete. O cliente busca no dia combinado.</p>
                    </section>
                ) : (
                    <Grupo titulo="Frete">
                        {FRETES.map((v) => (
                            <Opcao key={v} ativa={frete === v} onClick={() => setFrete(v)}>
                                {v === 0 ? 'Grátis' : formatCurrency(v)}
                            </Opcao>
                        ))}
                        <Opcao ativa={frete === 'outro'} onClick={() => setFrete('outro')}>Outro</Opcao>
                        {frete === 'outro' && (
                            <input
                                aria-label="Valor do frete"
                                inputMode="decimal"
                                placeholder="0,00"
                                autoFocus
                                value={freteOutro}
                                onChange={(e) => setFreteOutro(e.target.value.replace(/[^\d,.]/g, ''))}
                                className={cn(inputBase, 'basis-full tabular-nums')}
                            />
                        )}
                        <p className="basis-full text-xs text-muted-foreground">
                            {pedido.freteEstimado !== null
                                ? `Estimado pelo CEP: ${formatCurrency(pedido.freteEstimado)}. Troque se combinou outro.`
                                : 'Frete a combinar: escolha o valor (ou Grátis) que você combinou.'}
                        </p>
                    </Grupo>
                )}

                <Grupo titulo={retirada ? 'Dia de retirada' : 'Entrega'}>
                    <Opcao ativa={!dataOutra && data === hoje} onClick={() => { setDataOutra(false); setData(hoje) }}>
                        Hoje · {diaMes(hoje)}
                    </Opcao>
                    <Opcao ativa={!dataOutra && data === amanha} onClick={() => { setDataOutra(false); setData(amanha) }}>
                        Amanhã · {diaMes(amanha)}
                    </Opcao>
                    <Opcao ativa={dataOutra} onClick={() => { setDataOutra(true); setData(null) }}>Outro dia</Opcao>
                    {dataOutra && (
                        <input
                            type="date"
                            aria-label={retirada ? 'Dia de retirada' : 'Data de entrega'}
                            min={hoje}
                            value={data ?? ''}
                            onChange={(e) => setData(e.target.value || null)}
                            className={cn(inputBase, 'basis-full')}
                        />
                    )}
                </Grupo>

                <Grupo titulo="Pagamento">
                    {FORMAS.map((f) => (
                        <Opcao key={f.valor} ativa={forma === f.valor} onClick={() => setForma(f.valor)}>
                            {f.rotulo}
                        </Opcao>
                    ))}
                    {pedido.pagamentoPreferido && (
                        <p className="basis-full text-xs text-muted-foreground">
                            O cliente prefere {FORMAS.find((f) => f.valor === pedido.pagamentoPreferido)?.rotulo}.
                        </p>
                    )}
                    {forma === 'cartao' && (
                        <p className="basis-full text-xs text-muted-foreground">
                            No cartão, os produtos seguem a tabela do cartão; o total aparece depois de confirmar.
                        </p>
                    )}
                    {forma === 'dinheiro' && (
                        <p className="basis-full text-xs text-muted-foreground">
                            {retirada ? 'Recebe na retirada.' : 'O entregador recebe na entrega.'}
                        </p>
                    )}
                </Grupo>

                <section className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Quem indicou</h3>
                    {indicadorAtual ? (
                        <p className="text-sm text-muted-foreground">
                            Já indicado por {indicadorAtual.nome} no cadastro.
                        </p>
                    ) : (
                        <>
                            <p className="text-xs text-muted-foreground">
                                {pedido.indicadoPor
                                    ? `O cliente escreveu: “${pedido.indicadoPor}”. Escolha o cliente para contar no Ranking.`
                                    : 'Opcional. Escolha o cliente que indicou para contar no Ranking.'}
                            </p>
                            <FormIndicacao
                                selectedIndicador={indicador}
                                handleClearIndicador={() => setIndicador(null)}
                                indicadorSearch={busca}
                                setIndicadorSearch={setBusca}
                                showIndicadorDropdown={sugestoes.length > 0}
                                indicadorResults={sugestoes}
                                handleSelectIndicador={(c) => setIndicador({ id: c.id, nome: c.nome, telefone: c.telefone })}
                            />
                        </>
                    )}
                </section>

                <section className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">{retirada ? 'Retirada' : 'Endereço do pedido'}</h3>
                    <p className="text-sm text-muted-foreground">{retirada ? 'Retirada na Mont' : pedido.endereco}</p>
                    {perguntaEndereco && pedido.cadastro && (
                        <label className="flex items-start gap-3 rounded-xl border border-border bg-muted p-3 text-sm text-foreground">
                            <input
                                type="checkbox"
                                checked={atualizarEndereco}
                                onChange={(e) => setAtualizarEndereco(e.target.checked)}
                                className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-primary"
                            />
                            <span>
                                Trocar o endereço do cadastro pelo do pedido
                                <span className="block text-xs text-muted-foreground">
                                    No cadastro hoje: {pedido.cadastro.endereco || [pedido.cadastro.logradouro, pedido.cadastro.numero].filter(Boolean).join(', ')}
                                </span>
                            </span>
                        </label>
                    )}
                </section>
            </div>
        </Drawer>
    )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">{titulo}</h3>
            <div className="flex flex-wrap gap-2">{children}</div>
        </section>
    )
}

function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={ativa}
            onClick={onClick}
            className={cn(
                'min-h-11 rounded-xl border px-4 text-sm font-semibold tabular-nums transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                ativa ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-foreground hover:bg-muted',
            )}
        >
            {children}
        </button>
    )
}
