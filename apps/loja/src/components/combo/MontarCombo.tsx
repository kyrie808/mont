'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Foto } from '@/components/Foto'
import { Seletor } from '@/components/Seletor'
import { reais } from '@/lib/formato'
import type { Escolha } from '@/lib/sacola/esquema'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import type { ComboLoja, GrupoCombo } from '@/lib/vitrine/tipos'

type Quantidades = Record<string, Record<string, number>>

function quantidadesIniciais(escolhas: Escolha[] | undefined): Quantidades {
    const q: Quantidades = {}
    for (const e of escolhas ?? []) {
        q[e.grupoId] = { ...q[e.grupoId], [e.produtoId]: e.quantidade }
    }
    return q
}

function escolhidos(q: Quantidades, grupo: GrupoCombo): number {
    return Object.values(q[grupo.id] ?? {}).reduce((s, n) => s + n, 0)
}

/** Tela 03: escolher os sabores de um combo. */
export function MontarCombo({ combo }: { combo: ComboLoja }) {
    const pronta = useSacolaPronta()
    const chaveEdicao = useSearchParams().get('editar')
    // Remonta quando a sacola hidrata, para pré-carregar os sabores na edição.
    return <Editor key={pronta ? 'pronta' : 'carregando'} combo={combo} chaveEdicao={pronta ? chaveEdicao : null} />
}

function Editor({ combo, chaveEdicao }: { combo: ComboLoja; chaveEdicao: string | null }) {
    const router = useRouter()
    const adicionarCombo = useSacola((s) => s.adicionarCombo)
    const trocarEscolhas = useSacola((s) => s.trocarEscolhas)
    const [q, setQ] = useState<Quantidades>(() => {
        if (!chaveEdicao) return {}
        const item = useSacola.getState().itens.find((i) => i.tipo === 'combo' && i.chave === chaveEdicao)
        return item?.tipo === 'combo' && item.comboId === combo.id ? quantidadesIniciais(item.escolhas) : {}
    })

    const definir = (grupoId: string, produtoId: string, n: number) =>
        setQ((atual) => ({ ...atual, [grupoId]: { ...atual[grupoId], [produtoId]: Math.max(0, n) } }))

    const totalItens = combo.fixos.reduce((s, f) => s + f.quantidade, 0) + combo.grupos.reduce((s, g) => s + g.quantidade, 0)
    const linhaInfo = [
        combo.montavel ? `${totalItens} itens` : null,
        combo.ancora !== null ? `separado: a partir de ${reais(combo.ancora)}` : null,
    ]
        .filter(Boolean)
        .join(' · ')

    const incompleto = combo.grupos.find((g) => escolhidos(q, g) < g.quantidade)
    const completo = combo.montavel && combo.disponivel && !incompleto

    const porNaSacola = () => {
        const escolhas: Escolha[] = combo.grupos.flatMap((g) =>
            Object.entries(q[g.id] ?? {})
                .filter(([, n]) => n > 0)
                .map(([produtoId, quantidade]) => ({ grupoId: g.id, produtoId, quantidade })),
        )
        if (chaveEdicao) {
            trocarEscolhas(chaveEdicao, escolhas)
            router.push('/sacola')
        } else {
            adicionarCombo(combo.id, escolhas)
            router.push('/')
        }
    }

    let textoBloqueado = ''
    if (!combo.disponivel) textoBloqueado = 'Esgotado'
    else if (!combo.montavel) textoBloqueado = 'Sabores em definição'
    else if (incompleto) {
        const falta = incompleto.quantidade - escolhidos(q, incompleto)
        textoBloqueado =
            falta === 1 ? `Falta escolher 1 ${incompleto.rotuloSingular}` : `Faltam ${falta} ${incompleto.rotuloPlural}`
    }

    return (
        <div className="relative min-h-dvh pb-[100px]">
            <header className="flex h-14 items-center gap-1 border-b border-linha px-2">
                <Link href="/" aria-label="Voltar" className="flex h-11 w-11 items-center justify-center text-[22px] no-underline">
                    ←
                </Link>
                <span className="text-base font-bold">Montar combo</span>
            </header>

            <div className="flex flex-col gap-3 p-4">
                <div className="flex gap-3">
                    <Foto url={combo.imagemUrl} alt={combo.nome} largura={72} className="h-[72px] w-[72px] rounded-[10px]" />
                    <div className="flex flex-col gap-0.5">
                        <span className="font-titulo text-2xl leading-none uppercase">{combo.nome}</span>
                        {linhaInfo && <span className="text-[13px] text-texto-suave">{linhaInfo}</span>}
                        <span className="font-titulo text-[26px] leading-[1.1]">{reais(combo.preco)}</span>
                    </div>
                </div>

                {combo.fixos.length > 0 && (
                    <div className="flex flex-col gap-0.5 rounded-xl bg-areia px-3 py-2.5 text-[13px]">
                        <span className="font-bold">Já incluso</span>
                        <span>{combo.fixos.map((f) => `${f.quantidade} ${f.nome}`).join(' · ')}</span>
                    </div>
                )}

                {combo.grupos.length === 0 && (
                    <p className="mt-1 text-[13px] text-texto-suave">Os sabores deste combo ainda estão sendo definidos.</p>
                )}

                {combo.grupos.map((g) => {
                    const n = escolhidos(q, g)
                    const cheio = n >= g.quantidade
                    return (
                        <div key={g.id} className="flex flex-col">
                            <div className="mt-1 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[17px] font-bold">{g.titulo}</span>
                                    {g.permiteRepetir && <span className="text-xs text-texto-suave">Pode repetir sabor</span>}
                                </div>
                                <span
                                    className={`flex h-[30px] items-center rounded-[15px] px-3 text-sm font-bold text-creme ${cheio ? 'bg-verde' : 'bg-marrom'}`}
                                >
                                    {n}/{g.quantidade}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                {g.opcoes.map((o) => {
                                    const qtd = q[g.id]?.[o.produtoId] ?? 0
                                    const limiteSabor = !g.permiteRepetir && qtd >= 1
                                    return (
                                        <div key={o.produtoId} className="flex items-center gap-3 border-b border-linha py-2">
                                            <Foto url={o.imagemUrl} alt={o.nome} largura={44} className="h-11 w-11 rounded-[10px]" />
                                            <span
                                                className={`flex-1 text-[15px] font-medium ${o.disponivel ? 'text-marrom' : 'text-texto-suave'}`}
                                            >
                                                {o.nome}
                                            </span>
                                            {o.disponivel ? (
                                                <Seletor
                                                    variante="combo"
                                                    quantidade={qtd}
                                                    onMenos={() => definir(g.id, o.produtoId, qtd - 1)}
                                                    onMais={() => {
                                                        if (!cheio && !limiteSabor) definir(g.id, o.produtoId, qtd + 1)
                                                    }}
                                                    menosDesabilitado={qtd === 0}
                                                    maisDesabilitado={cheio || limiteSabor}
                                                />
                                            ) : (
                                                <span className="pr-2 text-xs font-bold text-texto-suave">Esgotado</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-linha bg-creme px-4 pt-3 pb-5">
                {completo ? (
                    <button
                        type="button"
                        onClick={porNaSacola}
                        className="flex h-14 w-full cursor-pointer items-center justify-center rounded-[28px] bg-laranja text-base font-bold text-marrom"
                    >
                        Pôr na sacola · {reais(combo.preco)}
                    </button>
                ) : (
                    <button
                        type="button"
                        disabled
                        className="h-14 w-full rounded-[28px] border-0 bg-linha text-base font-bold text-texto-suave"
                    >
                        {textoBloqueado}
                    </button>
                )}
            </div>
        </div>
    )
}
