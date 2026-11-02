'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { Foto } from '@/components/Foto'
import { Seletor } from '@/components/Seletor'
import { reais } from '@/lib/formato'
import { catalogoDa, descreverCombo, resumirSacola } from '@/lib/sacola/calculo'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import type { Vitrine } from '@/lib/vitrine/tipos'

interface SacolaProps {
    vitrine: Vitrine
}

const SEM_BAIRROS: ReadonlySet<string> = new Set()

/**
 * Tela 04: sacola e "Leva junto?". Sem cálculo de frete (decisão de 02/11): frete e dia de
 * entrega são combinados no WhatsApp, depois que o pedido chega.
 */
export function Sacola({ vitrine }: SacolaProps) {
    const pronta = useSacolaPronta()
    const itens = useSacola((s) => s.itens)
    const definirQuantidade = useSacola((s) => s.definirQuantidade)
    const adicionarProduto = useSacola((s) => s.adicionarProduto)
    const removerCombo = useSacola((s) => s.removerCombo)
    const manterSomente = useSacola((s) => s.manterSomente)

    const catalogo = useMemo(() => catalogoDa(vitrine), [vitrine])
    const resumo = useMemo(() => resumirSacola(pronta ? itens : [], catalogo), [pronta, itens, catalogo])

    // Tira da sacola o que saiu da vitrine (e o bairro guardado de antes, que não é mais usado).
    useEffect(() => {
        if (!pronta) return
        manterSomente(new Set([...catalogo.produtos.keys(), ...catalogo.combos.keys()]), SEM_BAIRROS)
    }, [pronta, catalogo, manterSomente])

    const leva = vitrine.levaJunto
    const mostrarLevaJunto =
        leva !== null && leva.disponivel && !itens.some((i) => i.tipo === 'produto' && i.produtoId === leva.id)
    const podeContinuar = resumo.linhas.length > 0 && !resumo.temPendencia

    return (
        <div className="relative min-h-dvh pb-[100px]">
            <header className="flex h-14 items-center gap-1 border-b border-linha px-2">
                <Link
                    href="/"
                    aria-label="Voltar para a loja"
                    className="flex h-11 w-11 items-center justify-center text-[22px] no-underline"
                >
                    ←
                </Link>
                <span className="text-base font-bold">Sua sacola</span>
                <span className="ml-auto pr-3 text-xs text-texto-suave">1 Sacola · 2 Dados</span>
            </header>

            {pronta && resumo.linhas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-4 pt-16 text-center">
                    <span className="text-[15px] text-texto-suave">Sua sacola está vazia.</span>
                    <Link href="/" className="text-sm font-bold">
                        Voltar para a loja
                    </Link>
                </div>
            ) : (
                <div className="flex flex-col gap-3 px-4 py-3">
                    {resumo.linhas.map((linha) =>
                        linha.tipo === 'combo' ? (
                            <article
                                key={linha.chave}
                                className="flex gap-3 rounded-[14px] border border-linha bg-white p-3"
                            >
                                <Foto
                                    url={linha.combo.imagemUrl}
                                    alt={linha.combo.nome}
                                    largura={56}
                                    className="h-14 w-14 rounded-[10px]"
                                />
                                <div className="flex flex-1 flex-col gap-1">
                                    <div className="flex justify-between">
                                        <span className="text-[15px] font-bold">{linha.combo.nome}</span>
                                        <span className="text-[15px] font-bold">{reais(linha.subtotal)}</span>
                                    </div>
                                    <span className="text-xs leading-[1.4] text-texto-suave">
                                        {descreverCombo(linha.combo, linha.escolhas)}
                                    </span>
                                    {!linha.vendavel && (
                                        <span className="text-xs font-bold text-texto-suave">
                                            Algum sabor acabou. Troque os sabores para continuar.
                                        </span>
                                    )}
                                    <div className="flex gap-4">
                                        <Link
                                            href={`/combo/${linha.combo.slug}?editar=${encodeURIComponent(linha.chave)}`}
                                            className="text-[13px] font-bold"
                                        >
                                            Trocar sabores
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => removerCombo(linha.chave)}
                                            className="cursor-pointer text-[13px] text-texto-suave underline"
                                        >
                                            Tirar
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ) : (
                            <article
                                key={linha.produto.id}
                                className="flex items-center gap-3 rounded-[14px] border border-linha bg-white p-3"
                            >
                                <Foto
                                    url={linha.produto.imagemUrl}
                                    alt={linha.produto.nome}
                                    largura={56}
                                    className="h-14 w-14 rounded-[10px]"
                                />
                                <div className="flex flex-1 flex-col gap-0.5">
                                    <span className="text-[15px] font-bold">{linha.produto.nome}</span>
                                    <span className="text-[13px]">
                                        {linha.vendavel ? reais(linha.produto.preco) : 'Esgotado'}
                                    </span>
                                </div>
                                <Seletor
                                    variante="sacola"
                                    quantidade={linha.quantidade}
                                    onMenos={() => definirQuantidade(linha.produto.id, linha.quantidade - 1)}
                                    onMais={() => definirQuantidade(linha.produto.id, linha.quantidade + 1)}
                                    maisDesabilitado={!linha.vendavel}
                                />
                            </article>
                        ),
                    )}

                    {pronta && mostrarLevaJunto && leva && (
                        <div className="flex items-center gap-3 rounded-[14px] bg-areia px-3 py-2.5">
                            <Foto url={leva.imagemUrl} alt={leva.nome} largura={44} className="h-11 w-11 rounded-[10px] bg-creme" />
                            <div className="flex flex-1 flex-col">
                                <span className="text-xs font-bold text-texto-suave">LEVA JUNTO?</span>
                                <span className="text-sm font-bold">
                                    {leva.nome} · {reais(leva.preco)}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => adicionarProduto(leva.id, 1)}
                                className="h-9 cursor-pointer rounded-[18px] border-[1.5px] border-marrom bg-transparent px-3.5 text-[13px] font-bold text-marrom"
                            >
                                + Pôr
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5 border-t border-linha pt-3 text-sm">
                        <div className="flex justify-between text-[17px] font-bold">
                            <span>Total no Pix</span>
                            <span>{reais(resumo.totalPix)}</span>
                        </div>
                        <span className="text-xs text-texto-suave">Frete e dia de entrega: combinamos no WhatsApp.</span>
                    </div>
                </div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-linha bg-creme px-4 pt-3 pb-5">
                {podeContinuar ? (
                    <Link
                        href="/checkout/dados"
                        className="flex h-14 items-center justify-center rounded-[28px] bg-laranja text-base font-bold text-marrom no-underline"
                    >
                        Continuar
                    </Link>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="h-14 w-full rounded-[28px] border-0 bg-linha text-base font-bold text-texto-suave"
                    >
                        Continuar
                    </button>
                )}
            </div>
        </div>
    )
}
