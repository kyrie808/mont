'use client'

import { useState } from 'react'
import { Seletor } from '@/components/Seletor'
import { reais } from '@/lib/formato'
import type { ProdutoLoja } from '@/lib/vitrine/tipos'

interface BarraProdutoProps {
    produto: ProdutoLoja
    /** Quantas unidades já estão na sacola (0 = nenhuma). */
    naSacola: number
    /** Quantidade final na sacola (não soma: a barra mostra e ajusta o que já está lá). */
    onConfirmar: (quantidade: number) => void
}

/** Ação do produto (quantidade + adicionar à sacola), igual no painel e na página do produto. */
export function BarraProduto({ produto, naSacola, onConfirmar }: BarraProdutoProps) {
    const [quantidade, setQuantidade] = useState(naSacola > 0 ? naSacola : 1)
    const jaNaSacola = naSacola > 0
    const rotuloBotao =
        jaNaSacola && quantidade === 0
            ? 'Tirar da sacola'
            : `${jaNaSacola ? 'Atualizar sacola' : 'Adicionar'} · ${reais(produto.preco * quantidade)}`

    return (
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
    )
}
