'use client'

import { useEffect, useRef } from 'react'
import { BarraProduto } from '@/components/produto/BarraProduto'
import { ConteudoProduto } from '@/components/produto/ConteudoProduto'
import { medirVisualizacao } from '@/lib/medicao/dataLayer'
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
    const painel = useRef<HTMLElement>(null)
    const fechar = useRef<HTMLButtonElement>(null)

    // O painel abre um produto por vez (key = id na Loja): abrir = ViewContent.
    useEffect(() => {
        medirVisualizacao(produto)
    }, [produto])

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

                    <ConteudoProduto produto={produto} classeFoto="h-[220px] rounded-xl" larguraFoto={390} />
                </div>

                {/* Ação sempre à vista, no alcance do polegar, por mais longa que seja a descrição. */}
                <BarraProduto produto={produto} naSacola={naSacola} onConfirmar={onConfirmar} />
            </section>
        </div>
    )
}
