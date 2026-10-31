import { useState } from 'react'
import { Minus, Plus, Package } from 'lucide-react'
import { cn, formatCurrency } from '@mont/shared'
import { Modal } from '../../../ui'
import type { ComboMontagem, DomainProduto } from '../../../../types/domain'
import {
    escolhasCompletas,
    escolhidosNoGrupo,
    faltamNoGrupo,
    type EscolhaCombo,
} from '../../../../utils/tabelaPreco'

interface MontarComboDialogProps {
    isOpen: boolean
    onClose: () => void
    combo: DomainProduto
    montagem: ComboMontagem
    /** Produtos ativos por id: nomes e fotos dos fixos e dos sabores. */
    produtosPorId: Map<string, DomainProduto>
    /** Preço do combo na tabela que está valendo. */
    preco: number
    /** Ao trocar sabores de um combo que já está no carrinho. */
    escolhasIniciais?: EscolhaCombo[]
    onConfirmar: (escolhas: EscolhaCombo[]) => void
}

/**
 * Montar combo da Black na Nova Venda: itens fixos + sabores de cada grupo (pode repetir onde
 * o grupo permite). O botão só libera com todos os grupos completos — o servidor confere de
 * novo (`combo_itens`) e recusa combo incompleto. Grupo sem sabores cadastrados (decisão
 * pendente) mostra o motivo e o combo não pode ser vendido.
 */
export function MontarComboDialog({
    isOpen,
    onClose,
    combo,
    montagem,
    produtosPorId,
    preco,
    escolhasIniciais,
    onConfirmar,
}: MontarComboDialogProps) {
    const [escolhas, setEscolhas] = useState<EscolhaCombo[]>(escolhasIniciais ?? [])

    const nome = (produtoId: string) => produtosPorId.get(produtoId)?.nome ?? 'Produto inativo'
    const sabores = montagem.grupos.some((g) => g.opcoes.length === 0) ? 'pendentes' : 'ok'
    const completo = sabores === 'ok' && escolhasCompletas(montagem.grupos, escolhas)

    const quantidadeDe = (grupoId: string, produtoId: string) =>
        escolhas.find((e) => e.grupoId === grupoId && e.produtoId === produtoId)?.quantidade ?? 0

    const mudar = (grupoId: string, produtoId: string, delta: number) => {
        setEscolhas((atual) => {
            const resto = atual.filter((e) => !(e.grupoId === grupoId && e.produtoId === produtoId))
            const nova = quantidadeDe(grupoId, produtoId) + delta
            return nova > 0 ? [...resto, { grupoId, produtoId, quantidade: nova }] : resto
        })
    }

    const primeiroIncompleto = montagem.grupos.find((g) => faltamNoGrupo(g, escolhas) > 0)
    const textoBotao = sabores === 'pendentes'
        ? 'Sabores em definição'
        : primeiroIncompleto
            ? (() => {
                const falta = faltamNoGrupo(primeiroIncompleto, escolhas)
                return falta === 1
                    ? `Falta 1 ${primeiroIncompleto.rotuloSingular}`
                    : `Faltam ${falta} ${primeiroIncompleto.rotuloPlural}`
            })()
            : `${escolhasIniciais ? 'Salvar sabores' : 'Adicionar ao carrinho'} · ${formatCurrency(preco)}`

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={combo.nome} size="lg">
            <div className="space-y-5 p-4">
                {montagem.fixos.length > 0 && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Já incluso</p>
                        <p className="text-sm text-foreground">
                            {montagem.fixos.map((f) => `${f.quantidade > 1 ? `${f.quantidade}× ` : ''}${nome(f.produtoId)}`).join(' · ')}
                        </p>
                    </div>
                )}

                {montagem.grupos.map((grupo) => {
                    const n = escolhidosNoGrupo(grupo.id, escolhas)
                    const cheio = n >= grupo.quantidade
                    return (
                        <section key={grupo.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">{grupo.titulo}</h3>
                                    {grupo.permiteRepetir && grupo.quantidade > 1 && (
                                        <p className="text-xs text-muted-foreground">Pode repetir sabor</p>
                                    )}
                                </div>
                                {grupo.opcoes.length > 0 && (
                                    <span
                                        className={cn(
                                            'rounded-full px-2.5 py-1 text-xs font-bold tabular-nums',
                                            cheio ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                                        )}
                                    >
                                        {n}/{grupo.quantidade}
                                    </span>
                                )}
                            </div>

                            {grupo.opcoes.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                                    Os sabores deste combo ainda não foram definidos. Ele não pode ser vendido até o cadastro.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border rounded-xl border border-border">
                                    {grupo.opcoes.map((produtoId) => {
                                        const qtd = quantidadeDe(grupo.id, produtoId)
                                        const produto = produtosPorId.get(produtoId)
                                        const podeMais = !cheio && (grupo.permiteRepetir || qtd === 0)
                                        return (
                                            <li key={produtoId} className="flex items-center gap-3 p-2.5">
                                                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                                                    {produto?.imagemUrl ? (
                                                        <img src={produto.imagemUrl} alt="" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <Package className="size-5 text-muted-foreground/50" />
                                                    )}
                                                </div>
                                                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{nome(produtoId)}</span>
                                                <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                                                    <button
                                                        type="button"
                                                        aria-label={`Tirar um ${nome(produtoId)}`}
                                                        onClick={() => mudar(grupo.id, produtoId, -1)}
                                                        disabled={qtd === 0}
                                                        className="flex size-9 items-center justify-center rounded-md border border-border bg-background transition-transform active:scale-95 disabled:opacity-40"
                                                    >
                                                        <Minus className="size-4" />
                                                    </button>
                                                    <span className="w-6 text-center text-sm font-bold tabular-nums">{qtd}</span>
                                                    <button
                                                        type="button"
                                                        aria-label={`Pôr mais um ${nome(produtoId)}`}
                                                        onClick={() => mudar(grupo.id, produtoId, 1)}
                                                        disabled={!podeMais}
                                                        className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
                                                    >
                                                        <Plus className="size-4" />
                                                    </button>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </section>
                    )
                })}

                <button
                    type="button"
                    disabled={!completo}
                    onClick={() => onConfirmar(escolhas)}
                    className={cn(
                        'h-12 w-full rounded-xl text-sm font-bold transition-all active:scale-[0.99]',
                        completo
                            ? 'bg-primary text-primary-foreground shadow-elevated hover:opacity-90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground',
                    )}
                >
                    {textoBotao}
                </button>
            </div>
        </Modal>
    )
}
