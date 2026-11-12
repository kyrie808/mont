import { reais } from '@/lib/formato'
import { cartaoTemOutroPreco } from '@/lib/vitrine/cartao'
import type { ProdutoLoja } from '@/lib/vitrine/tipos'
import { GaleriaFotos } from './GaleriaFotos'

interface ConteudoProdutoProps {
    produto: ProdutoLoja
    /** Altura e cantos da foto (o painel e a página usam tamanhos diferentes). */
    classeFoto: string
    /** Largura aproximada da foto em px no celular. */
    larguraFoto: number
}

/** Miolo do produto, igual no painel da home e na página /produto/[slug]: fotos, nome, preço e textos do cadastro. */
export function ConteudoProduto({ produto, classeFoto, larguraFoto }: ConteudoProdutoProps) {
    // Na campanha: com o cartão no mesmo preço do Pix, um selo só; com preço diferente, "no Pix" + a linha do cartão.
    const naCampanha = produto.precoCredito !== null
    const cartaoDiferente = cartaoTemOutroPreco(produto)
    const linhasDescricao = (produto.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)

    return (
        <>
            <GaleriaFotos
                fotos={produto.fotos}
                alt={produto.nome}
                largura={larguraFoto}
                prioridade
                esgotado={!produto.disponivel}
                className={classeFoto}
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
                {naCampanha && (
                    <span className="text-[13px] font-bold text-verde">{cartaoDiferente ? 'no Pix' : 'Pix, dinheiro ou cartão'}</span>
                )}
            </div>
            {cartaoDiferente && produto.precoCredito !== null && (
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
        </>
    )
}
