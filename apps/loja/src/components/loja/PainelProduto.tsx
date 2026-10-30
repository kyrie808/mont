'use client'

import { useEffect, useState } from 'react'
import { Foto } from '@/components/Foto'
import { Seletor } from '@/components/Seletor'
import { reais } from '@/lib/formato'
import type { ProdutoLoja } from '@/lib/vitrine/tipos'

interface PainelProdutoProps {
    produto: ProdutoLoja
    onFechar: () => void
    onAdicionar: (quantidade: number) => void
}

/** Tela 02: o produto abre como painel por cima da loja (não troca de página). */
export function PainelProduto({ produto, onFechar, onAdicionar }: PainelProdutoProps) {
    const [quantidade, setQuantidade] = useState(1)

    useEffect(() => {
        const overflowAntes = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const aoTeclar = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onFechar()
        }
        window.addEventListener('keydown', aoTeclar)
        return () => {
            document.body.style.overflow = overflowAntes
            window.removeEventListener('keydown', aoTeclar)
        }
    }, [onFechar])

    const linhasDescricao = (produto.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            <button
                type="button"
                aria-label="Fechar"
                onClick={onFechar}
                className="absolute inset-0 cursor-default bg-marrom/45"
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-label={produto.nome}
                className="relative flex h-[85dvh] w-full max-w-[430px] flex-col gap-3 overflow-y-auto rounded-t-[24px] bg-creme px-5 pt-3 pb-5"
            >
                <div className="relative flex items-center justify-end">
                    <span aria-hidden="true" className="absolute left-1/2 h-1 w-10 -translate-x-1/2 rounded-sm bg-tracejado" />
                    <button
                        type="button"
                        aria-label="Fechar"
                        onClick={onFechar}
                        className="flex h-11 w-11 items-center justify-center text-[22px]"
                    >
                        ×
                    </button>
                </div>

                <Foto url={produto.imagemUrl} alt={produto.nome} largura={390} className="h-[220px] rounded-xl" />

                <h1 className="mt-1 text-[22px] font-bold">{produto.nome}</h1>

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

                <div className="mt-auto flex items-center gap-3 pt-2">
                    {produto.disponivel ? (
                        <>
                            <Seletor
                                variante="painel"
                                quantidade={quantidade}
                                onMenos={() => setQuantidade((q) => Math.max(1, q - 1))}
                                onMais={() => setQuantidade((q) => Math.min(99, q + 1))}
                            />
                            <button
                                type="button"
                                onClick={() => onAdicionar(quantidade)}
                                className="flex h-[52px] flex-1 items-center justify-center rounded-[26px] bg-laranja text-base font-bold text-marrom"
                            >
                                Adicionar · {reais(produto.preco * quantidade)}
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
