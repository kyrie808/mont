import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Search, Plus, Minus, X } from 'lucide-react'
import { formatCurrency, cn } from '@mont/shared'
import type { DomainProduto } from '../../../../types/domain'
import { montarGrupos, buscarProdutos, type SecaoLista } from '../../../../utils/listaNovaVenda'

interface ProductListProps {
    produtos: DomainProduto[]
    loading: boolean
    /** Seções da tela Catálogo (mesma fonte e ordem da loja). */
    secoes: SecaoLista[]
    /** Ids por número de vendas nos últimos 90 dias; vazio = sem "Mais vendidos". */
    maisVendidos: string[]
    getQuantity: (produtoId: string) => number
    onAdd: (produto: DomainProduto) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
    /** Combo com escolha de sabor: 'montar' abre o seletor; 'pendente' = sabores em definição. */
    acaoCombo?: (produto: DomainProduto) => 'montar' | 'pendente' | null
    /** Combo no preço normal: "Fiado: R$ 345,00 · no Pix: R$ 199,00" (null = sem nota). */
    notaPreco?: (produto: DomainProduto) => string | null
}

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const botaoQtd = cn('flex size-11 shrink-0 items-center justify-center rounded-xl active:scale-95 transition-transform', foco)

const semMovimento = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Lista da Nova Venda no celular: busca + chips de seção grudados no topo, produtos agrupados
 * pelas seções do Catálogo com os mais vendidos primeiro, e "− qtd +" na própria linha.
 *
 * O AppLayout tem `overflow-x-hidden`, que anula `sticky`: a barra vira `fixed` quando a
 * sentinela sai da tela, e um espaço da mesma altura segura o lugar dela no fluxo.
 */
export function ProductList({ produtos, loading, secoes, maisVendidos, getQuantity, onAdd, onUpdateQuantity, acaoCombo, notaPreco }: ProductListProps) {
    const [busca, setBusca] = useState('')
    const buscando = busca.trim().length > 0

    const grupos = useMemo(() => montarGrupos(produtos, secoes, maisVendidos), [produtos, secoes, maisVendidos])
    const achados = useMemo(() => (buscando ? buscarProdutos(grupos, busca) : []), [grupos, busca, buscando])

    // ── Barra grudada no topo ──────────────────────────────────────────
    const sentinelaRef = useRef<HTMLDivElement>(null)
    const barraRef = useRef<HTMLDivElement>(null)
    const [grudada, setGrudada] = useState(false)
    const [alturaBarra, setAlturaBarra] = useState(0)

    useEffect(() => {
        const sentinela = sentinelaRef.current
        if (!sentinela || typeof IntersectionObserver === 'undefined') return
        const observador = new IntersectionObserver(([e]) => setGrudada(!e.isIntersecting && e.boundingClientRect.top < 0))
        observador.observe(sentinela)
        return () => observador.disconnect()
    }, [loading])

    useEffect(() => {
        const barra = barraRef.current
        if (!barra || typeof ResizeObserver === 'undefined') return
        const observador = new ResizeObserver(() => setAlturaBarra(barra.offsetHeight))
        observador.observe(barra)
        return () => observador.disconnect()
    }, [loading])

    // ── Chip ativo acompanha a rolagem ─────────────────────────────────
    const secoesRef = useRef(new Map<string, HTMLElement>())
    const chipsRef = useRef(new Map<string, HTMLButtonElement>())
    const [ativo, setAtivo] = useState<string | null>(null)
    const travaAte = useRef(0)

    useEffect(() => {
        if (buscando || grupos.length === 0) return
        let quadro = 0
        const aoRolar = () => {
            cancelAnimationFrame(quadro)
            quadro = requestAnimationFrame(() => {
                if (Date.now() < travaAte.current) return
                const linha = (barraRef.current?.offsetHeight ?? 0) + 16
                let atual = grupos[0].id
                for (const g of grupos) {
                    const el = secoesRef.current.get(g.id)
                    if (el && el.getBoundingClientRect().top <= linha) atual = g.id
                }
                setAtivo(atual)
            })
        }
        aoRolar()
        window.addEventListener('scroll', aoRolar, { passive: true })
        return () => {
            cancelAnimationFrame(quadro)
            window.removeEventListener('scroll', aoRolar)
        }
    }, [grupos, buscando])

    // Chip ativo sempre à vista na faixa (rola só a faixa, nunca a página).
    useEffect(() => {
        const chip = ativo ? chipsRef.current.get(ativo) : undefined
        const faixa = chip?.parentElement
        if (!chip || !faixa) return
        // Folga de 16 px nas bordas; fora dela, centraliza o chip (os vizinhos ficam à vista).
        const esquerda = chip.offsetLeft - faixa.offsetLeft
        const folga = 16
        if (esquerda < faixa.scrollLeft + folga || esquerda + chip.offsetWidth > faixa.scrollLeft + faixa.clientWidth - folga) {
            faixa.scrollTo({ left: esquerda - (faixa.clientWidth - chip.offsetWidth) / 2, behavior: semMovimento() ? 'auto' : 'smooth' })
        }
    }, [ativo])

    const irPara = useCallback((id: string) => {
        const el = secoesRef.current.get(id)
        if (!el) return
        setAtivo(id)
        travaAte.current = Date.now() + 800
        const topo = el.getBoundingClientRect().top + window.scrollY - (barraRef.current?.offsetHeight ?? 0) - 4
        window.scrollTo({ top: topo, behavior: semMovimento() ? 'auto' : 'smooth' })
    }, [])

    // Ao buscar com a barra grudada, volta para o começo da lista (resultado fica à vista).
    const aoBuscar = (valor: string) => {
        setBusca(valor)
        const sentinela = sentinelaRef.current
        if (grudada && sentinela) window.scrollTo({ top: sentinela.getBoundingClientRect().top + window.scrollY })
    }

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Carregando produtos…</div>
    }

    const linha = (produto: DomainProduto) => (
        <LinhaProduto
            key={produto.id}
            produto={produto}
            quantidade={getQuantity(produto.id)}
            combo={acaoCombo?.(produto) ?? null}
            nota={notaPreco?.(produto) ?? null}
            onAdd={onAdd}
            onUpdateQuantity={onUpdateQuantity}
        />
    )

    return (
        <div>
            <div ref={sentinelaRef} aria-hidden className="h-px" />
            <div style={grudada ? { height: alturaBarra } : undefined}>
                <div
                    ref={barraRef}
                    className={cn(
                        'bg-muted/95 backdrop-blur-md',
                        grudada ? 'fixed inset-x-0 top-0 z-header border-b border-border px-4' : '-mx-4 px-4'
                    )}
                >
                    <div className="relative pt-3">
                        <Search aria-hidden className="pointer-events-none absolute left-3 top-[calc(50%+6px)] size-5 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="search"
                            inputMode="search"
                            enterKeyHint="search"
                            aria-label="Buscar produto por nome ou apelido"
                            placeholder="Buscar por nome ou apelido"
                            value={busca}
                            onChange={(e) => aoBuscar(e.target.value)}
                            className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-11 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
                        />
                        {buscando && (
                            <button
                                type="button"
                                aria-label="Limpar busca"
                                onClick={() => setBusca('')}
                                className={cn('absolute right-0 top-3 flex size-11 items-center justify-center rounded-xl text-muted-foreground', foco)}
                            >
                                <X className="size-5" />
                            </button>
                        )}
                    </div>

                    {!buscando && grupos.length > 1 ? (
                        <nav aria-label="Seções" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2">
                            {grupos.map((g) => (
                                <button
                                    key={g.id}
                                    ref={(el) => { if (el) chipsRef.current.set(g.id, el); else chipsRef.current.delete(g.id) }}
                                    type="button"
                                    aria-current={ativo === g.id ? 'true' : undefined}
                                    onClick={() => irPara(g.id)}
                                    className={cn(
                                        'h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors',
                                        foco,
                                        ativo === g.id ? 'border border-foreground bg-foreground text-background' : 'border border-border bg-card text-foreground'
                                    )}
                                >
                                    {g.nome}
                                </button>
                            ))}
                        </nav>
                    ) : (
                        <div className="h-3" />
                    )}
                </div>
            </div>

            {buscando ? (
                achados.length > 0 ? (
                    <ul className="divide-y divide-border">{achados.map(linha)}</ul>
                ) : (
                    <div className="py-10 text-center">
                        <p className="text-sm text-muted-foreground">Nenhum produto com “{busca.trim()}”.</p>
                        <button
                            type="button"
                            onClick={() => setBusca('')}
                            className={cn('mt-3 h-11 rounded-xl px-4 text-sm font-semibold text-primary', foco)}
                        >
                            Limpar busca
                        </button>
                    </div>
                )
            ) : grupos.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto à venda agora.</p>
            ) : (
                grupos.map((g) => (
                    <section
                        key={g.id}
                        aria-labelledby={`grupo-${g.id}`}
                        ref={(el) => { if (el) secoesRef.current.set(g.id, el); else secoesRef.current.delete(g.id) }}
                        className="pt-4 first:pt-2"
                    >
                        <h3 id={`grupo-${g.id}`} className="pb-1 text-base font-bold text-foreground">{g.nome}</h3>
                        <ul className="divide-y divide-border">{g.produtos.map(linha)}</ul>
                    </section>
                ))
            )}
        </div>
    )
}

interface LinhaProdutoProps {
    produto: DomainProduto
    quantidade: number
    combo: 'montar' | 'pendente' | null
    nota: string | null
    onAdd: (produto: DomainProduto) => void
    onUpdateQuantity: (produtoId: string, delta: number) => void
}

function LinhaProduto({ produto, quantidade, combo, nota, onAdd, onUpdateQuantity }: LinhaProdutoProps) {
    return (
        <li className="flex min-h-16 items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
                <p className={cn('line-clamp-2 text-[15px] leading-snug text-foreground', quantidade > 0 ? 'font-semibold' : 'font-medium')}>
                    {produto.nome}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                    {nota ?? formatCurrency(Number(produto.preco))}
                </p>
            </div>

            {combo === 'pendente' ? (
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">Sabores em definição</span>
            ) : combo === 'montar' ? (
                <div className="flex shrink-0 items-center gap-1">
                    {quantidade > 0 && (
                        <span className="w-8 text-center text-base font-bold tabular-nums text-foreground" aria-label={`${quantidade} no carrinho`}>
                            {quantidade}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={() => onAdd(produto)}
                        aria-label={`${quantidade > 0 ? 'Montar outro' : 'Montar'} ${produto.nome}`}
                        className={cn('h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-95 transition-transform', foco)}
                    >
                        {quantidade > 0 ? 'Montar outro' : 'Montar'}
                    </button>
                </div>
            ) : (
                <div className="flex shrink-0 items-center gap-1">
                    {quantidade > 0 && (
                        <>
                            <button
                                type="button"
                                aria-label={`Diminuir ${produto.nome}`}
                                onClick={() => onUpdateQuantity(produto.id, -1)}
                                className={cn(botaoQtd, 'border border-border bg-card text-foreground')}
                            >
                                <Minus className="size-5" />
                            </button>
                            <span className="w-8 text-center text-base font-bold tabular-nums text-foreground" aria-live="polite">
                                {quantidade}
                            </span>
                        </>
                    )}
                    <button
                        type="button"
                        aria-label={`Adicionar ${produto.nome}`}
                        onClick={() => (quantidade > 0 ? onUpdateQuantity(produto.id, 1) : onAdd(produto))}
                        className={cn(
                            botaoQtd,
                            quantidade > 0 ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'
                        )}
                    >
                        <Plus className="size-5" />
                    </button>
                </div>
            )}
        </li>
    )
}
