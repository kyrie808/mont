import { useState, type ReactNode } from 'react'
import { formatCurrency } from '@mont/shared'
import { cn } from '@mont/shared'
import { Button, Drawer } from '../../ui'
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
}

/** Frete, data de entrega e forma de pagamento em toques; o pedido vira venda pendente. */
export function ConfirmarPedidoDrawer({ pedido, confirmando, onClose, onConfirmar }: ConfirmarPedidoDrawerProps) {
    if (!pedido) return null
    // A chave reinicia o formulário a cada pedido aberto.
    return <Formulario key={pedido.id} pedido={pedido} confirmando={confirmando} onClose={onClose} onConfirmar={onConfirmar} />
}

function Formulario({ pedido, confirmando, onClose, onConfirmar }: ConfirmarPedidoDrawerProps & { pedido: PedidoLoja }) {
    const hoje = hojeSP()
    const amanha = somarDias(hoje, 1)

    const [frete, setFrete] = useState<number | 'outro' | null>(null)
    const [freteOutro, setFreteOutro] = useState('')
    const [data, setData] = useState<string | null>(null)
    const [dataOutra, setDataOutra] = useState(false)
    const [forma, setForma] = useState<FormaPagamentoLoja | null>(null)
    const [atualizarEndereco, setAtualizarEndereco] = useState(false)

    const freteValor = frete === 'outro' ? Number(freteOutro.replace(',', '.')) : frete
    const freteOk = freteValor !== null && Number.isFinite(freteValor) && freteValor >= 0 && freteValor <= 500
    const pronto = freteOk && data !== null && forma !== null
    const perguntaEndereco = enderecoDiferente(
        { logradouro: pedido.logradouro, numero: pedido.numeroEndereco },
        pedido.cadastro ? { logradouro: pedido.cadastro.logradouro, numero: pedido.cadastro.numero } : null,
    )

    const confirmar = () => {
        if (!pronto || freteValor === null || data === null || forma === null || confirmando) return
        onConfirmar({ frete: freteValor, dataEntrega: data, forma, atualizarEndereco: perguntaEndereco && atualizarEndereco })
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
                </Grupo>

                <Grupo titulo="Entrega">
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
                            aria-label="Data de entrega"
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
                    {forma === 'cartao' && (
                        <p className="basis-full text-xs text-muted-foreground">
                            No cartão, os produtos seguem a tabela do cartão; o total aparece depois de confirmar.
                        </p>
                    )}
                    {forma === 'dinheiro' && (
                        <p className="basis-full text-xs text-muted-foreground">O entregador recebe na entrega.</p>
                    )}
                </Grupo>

                <section className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Endereço do pedido</h3>
                    <p className="text-sm text-muted-foreground">{pedido.endereco}</p>
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
