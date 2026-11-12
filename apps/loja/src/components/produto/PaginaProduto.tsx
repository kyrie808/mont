'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { Foto } from '@/components/Foto'
import { IconeSacola } from '@/components/IconeSacola'
import { reais } from '@/lib/formato'
import { medirAdicao, medirVisualizacao } from '@/lib/medicao/dataLayer'
import { catalogoDa, resumirSacola } from '@/lib/sacola/calculo'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import type { ProdutoLoja, Vitrine } from '@/lib/vitrine/tipos'
import { BarraProduto } from './BarraProduto'
import { ConteudoProduto } from './ConteudoProduto'

interface PaginaProdutoProps {
    produto: ProdutoLoja
    /** A vitrine inteira: o selo da sacola conta como na home (só o que ainda está à venda). */
    vitrine: Vitrine
    /** "Leve junto": comprados junto com este, completados pela categoria (lib/vitrine/compradosJuntos). */
    juntos: ProdutoLoja[]
    /** WhatsApp da Mont (o "Me avisa quando chegar" do esgotado). */
    whatsapp: string
}

/** Página do produto (/produto/[slug]): o link compartilhado e o Google abrem aqui; na home, o produto abre no painel. */
export function PaginaProduto({ produto, vitrine, juntos, whatsapp }: PaginaProdutoProps) {
    const pronta = useSacolaPronta()
    const itens = useSacola((s) => s.itens)
    const definirQuantidade = useSacola((s) => s.definirQuantidade)

    const quantidadeDe = (id: string): number => {
        if (!pronta) return 0
        const item = itens.find((i) => i.tipo === 'produto' && i.produtoId === id)
        return item?.tipo === 'produto' ? item.quantidade : 0
    }
    const naSacola = quantidadeDe(produto.id)
    const catalogo = useMemo(() => catalogoDa(vitrine), [vitrine])
    const totalNaSacola = useMemo(() => resumirSacola(pronta ? itens : [], catalogo).quantidadeItens, [pronta, itens, catalogo])

    useEffect(() => {
        medirVisualizacao(produto)
    }, [produto])

    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex h-14 items-center gap-1 border-b border-linha px-2">
                <Link href="/" className="flex h-11 items-center gap-2 px-2 text-base font-bold no-underline">
                    <span aria-hidden="true" className="text-[22px]">
                        ←
                    </span>
                    Loja
                </Link>
                <Link
                    href="/sacola"
                    aria-label={`Abrir sacola, ${totalNaSacola} ${totalNaSacola === 1 ? 'item' : 'itens'}`}
                    className="relative mr-2 ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-linha"
                >
                    <IconeSacola />
                    {totalNaSacola > 0 && (
                        <span
                            key={totalNaSacola}
                            className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-laranja text-xs font-bold text-marrom motion-safe:animate-pulsar"
                        >
                            {totalNaSacola}
                        </span>
                    )}
                </Link>
            </header>

            <div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-6">
                <ConteudoProduto produto={produto} classeFoto="h-[300px] rounded-xl" larguraFoto={390} />

                {juntos.length > 0 && (
                    <section aria-labelledby="leve-junto" className="mt-4 flex flex-col gap-2.5">
                        <h2 id="leve-junto" className="font-titulo text-[22px] font-normal uppercase tracking-[0.5px]">
                            Leve junto
                        </h2>
                        <ul className="-mx-5 flex list-none gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {juntos.map((p) => (
                                <li key={p.id} className="w-[132px] shrink-0">
                                    <Link
                                        href={`/produto/${p.slug}`}
                                        className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-white p-2 no-underline"
                                    >
                                        <Foto url={p.imagemUrl} alt="" largura={116} className="h-[96px] w-full rounded-xl" />
                                        <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-tight font-bold">{p.nome}</span>
                                        <span className="font-titulo text-lg leading-none">{reais(p.preco)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            {/* Ação sempre à vista, como no painel. Remonta quando a sacola é lida do aparelho ou muda. */}
            <div className="sticky bottom-0 z-30 bg-creme">
                <BarraProduto
                    key={`${pronta}-${naSacola}`}
                    produto={produto}
                    naSacola={naSacola}
                    whatsapp={whatsapp}
                    onConfirmar={(q) => {
                        medirAdicao(produto, q - naSacola)
                        definirQuantidade(produto.id, q)
                    }}
                />
            </div>

            <p role="status" className="sr-only">
                {naSacola > 0 ? `${produto.nome}: ${naSacola} na sacola` : ''}
            </p>
        </div>
    )
}
