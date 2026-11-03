'use client'

import { useEffect, useRef, useState } from 'react'
import { Foto } from '@/components/Foto'
import { Seletor } from '@/components/Seletor'
import { reais } from '@/lib/formato'
import type { ProdutoLoja } from '@/lib/vitrine/tipos'

interface PainelProdutoProps {
    produto: ProdutoLoja
    /** Quantas unidades já estão na sacola (0 = nenhuma). */
    naSacola: number
    /** Aberto pelo teclado: o foco vai para o "×" (com contorno). Pelo toque: para o painel. */
    focarFechar: boolean
    onFechar: () => void
    /** Quantidade final na sacola (não soma: o painel mostra e ajusta o que já está lá). */
    onConfirmar: (quantidade: number) => void
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Tela 02: o produto abre como painel por cima da loja (não troca de página). */
export function PainelProduto({ produto, naSacola, focarFechar, onFechar, onConfirmar }: PainelProdutoProps) {
    const [quantidade, setQuantidade] = useState(naSacola > 0 ? naSacola : 1)
    const painel = useRef<HTMLElement>(null)
    const fechar = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const overflowAntes = document.body.style.overflow
        const focoAntes = document.activeElement instanceof HTMLElement ? document.activeElement : null
        document.body.style.overflow = 'hidden'
        if (focarFechar) fechar.current?.focus()
        else painel.current?.focus()

        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onFechar()
            // O foco não sai do painel enquanto ele está aberto.
            if (e.key === 'Tab' && painel.current) {
                const focaveis = [...painel.current.querySelectorAll<HTMLElement>(FOCAVEIS)]
                const primeiro = focaveis[0]
                const ultimo = focaveis[focaveis.length - 1]
                if (!primeiro || !ultimo) return
                if (e.shiftKey && document.activeElement === primeiro) {
                    e.preventDefault()
                    ultimo.focus()
                } else if (!e.shiftKey && document.activeElement === ultimo) {
                    e.preventDefault()
                    primeiro.focus()
                }
            }
        }
        window.addEventListener('keydown', aoTeclar)
        return () => {
            document.body.style.overflow = overflowAntes
            window.removeEventListener('keydown', aoTeclar)
            focoAntes?.focus()
        }
    }, [onFechar, focarFechar])

    const linhasDescricao = (produto.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

    const jaNaSacola = naSacola > 0
    const rotuloBotao =
        jaNaSacola && quantidade === 0
            ? 'Tirar da sacola'
            : `${jaNaSacola ? 'Atualizar sacola' : 'Adicionar'} · ${reais(produto.preco * quantidade)}`

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <button
                type="button"
                aria-label="Fechar"
                tabIndex={-1}
                onClick={onFechar}
                className="absolute inset-0 cursor-default bg-marrom/45 motion-safe:animate-surgir"
            />
            <section
                ref={painel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={produto.nome}
                className="relative flex h-[85dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-creme outline-none motion-safe:animate-subir motion-reduce:animate-surgir"
            >
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-3 pb-4">
                    <div className="relative flex items-center justify-end">
                        <span aria-hidden="true" className="absolute left-1/2 h-1 w-10 -translate-x-1/2 rounded-sm bg-tracejado" />
                        <button
                            ref={fechar}
                            type="button"
                            aria-label="Fechar"
                            onClick={onFechar}
                            className="flex h-11 w-11 items-center justify-center rounded-full text-[22px]"
                        >
                            ×
                        </button>
                    </div>

                    <Foto
                        url={produto.imagemUrl}
                        alt={produto.nome}
                        largura={390}
                        prioridade
                        className="h-[220px] shrink-0 rounded-xl"
                    />

                    <div className="mt-1 flex flex-col items-start gap-1.5">
                        {produto.selo && (
                            <span className="rounded-full bg-areia px-2 py-0.5 text-[11px] leading-tight font-bold text-marrom">
                                {produto.selo}
                            </span>
                        )}
                        <h1 className="text-[22px] font-bold">{produto.nome}</h1>
                    </div>

                    <div className="flex items-baseline gap-2">
                        {produto.precoDe !== null && (
                            <span className="text-sm text-texto-suave line-through">{reais(produto.precoDe)}</span>
                        )}
                        <span className="font-titulo text-[34px] leading-none">{reais(produto.preco)}</span>
                        {produto.precoCredito !== null && <span className="text-[13px] font-bold text-verde">no Pix</span>}
                    </div>
                    {produto.precoCredito !== null && (
                        <span className="text-[13px] text-texto-suave">Cartão de crédito: {reais(produto.precoCredito)}</span>
                    )}

                    {linhasDescricao.length > 0 && (
                        <ul className="mt-1 flex list-none flex-col gap-1.5 p-0 text-sm">
                            {linhasDescricao.map((linha, i) => (
                                <li key={i}>{linha}</li>
                            ))}
                        </ul>
                    )}

                    {produto.beneficios.length > 0 && (
                        <ul className="flex list-none flex-col gap-1.5 p-0 text-sm">
                            {produto.beneficios.map((b, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <svg
                                        aria-hidden="true"
                                        viewBox="0 0 16 16"
                                        className="mt-0.5 h-4 w-4 shrink-0 text-verde"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M3 8.5l3 3 7-7" />
                                    </svg>
                                    {b}
                                </li>
                            ))}
                        </ul>
                    )}

                    {produto.preparo.length > 0 && (
                        <section className="mt-2 flex flex-col gap-1.5">
                            <h2 className="text-base font-bold">Modo de preparo</h2>
                            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm marker:text-texto-suave">
                                {produto.preparo.map((passo, i) => (
                                    <li key={i}>{passo}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* Ação sempre à vista, no alcance do polegar, por mais longa que seja a descrição. */}
                <div className="flex items-center gap-3 border-t border-linha px-5 pt-3 pb-5">
                    {produto.disponivel ? (
                        <>
                            <Seletor
                                variante="painel"
                                nome={produto.nome}
                                quantidade={quantidade}
                                onMenos={() => setQuantidade((q) => Math.max(jaNaSacola ? 0 : 1, q - 1))}
                                onMais={() => setQuantidade((q) => Math.min(99, q + 1))}
                                menosDesabilitado={quantidade <= (jaNaSacola ? 0 : 1)}
                            />
                            <button
                                type="button"
                                onClick={() => onConfirmar(quantidade)}
                                className="flex h-[52px] flex-1 items-center justify-center rounded-[26px] bg-laranja text-base font-bold text-marrom"
                            >
                                {rotuloBotao}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            disabled
                            className="h-[52px] flex-1 rounded-[26px] bg-linha text-base font-bold text-texto-suave"
                        >
                            Esgotado
                        </button>
                    )}
                </div>
            </section>
        </div>
    )
}
