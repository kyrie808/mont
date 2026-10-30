'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef } from 'react'
import { cn } from '@mont/shared'
import { Foto } from '@/components/Foto'
import { IconeSacola } from '@/components/IconeSacola'
import { Seletor } from '@/components/Seletor'
import { diaMesSP, linkWhatsApp, reais } from '@/lib/formato'
import { catalogoDa, resumirSacola } from '@/lib/sacola/calculo'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import type { ComboLoja, ProdutoLoja, Vitrine } from '@/lib/vitrine/tipos'
import { PainelProduto } from './PainelProduto'

interface LojaProps {
    vitrine: Vitrine
    whatsapp: string
}

const tituloSecao = 'font-titulo text-[26px] font-normal uppercase tracking-[0.5px]'
const botaoAdicionar =
    'h-10 cursor-pointer rounded-[20px] border-[1.5px] border-marrom bg-creme px-4 text-sm font-bold text-marrom'

/** Tela 01: a loja em página única. */
export function Loja({ vitrine, whatsapp }: LojaProps) {
    const pronta = useSacolaPronta()
    const itens = useSacola((s) => s.itens)
    const definirQuantidade = useSacola((s) => s.definirQuantidade)
    const adicionarProduto = useSacola((s) => s.adicionarProduto)

    const catalogo = useMemo(() => catalogoDa(vitrine), [vitrine])
    const resumo = useMemo(() => resumirSacola(pronta ? itens : [], catalogo), [pronta, itens, catalogo])

    const quantidadeDe = (produtoId: string): number => {
        if (!pronta) return 0
        const item = itens.find((i) => i.tipo === 'produto' && i.produtoId === produtoId)
        return item?.tipo === 'produto' ? item.quantidade : 0
    }

    // Painel de produto (tela 02) por cima da loja, na própria URL (?produto=slug), para o "voltar" do celular fechar.
    const params = useSearchParams()
    const slugAberto = params.get('produto')
    const produtoAberto = slugAberto ? [...catalogo.produtos.values()].find((p) => p.slug === slugAberto) : undefined
    const empilhou = useRef(false)

    const abrir = (produto: ProdutoLoja) => {
        window.history.pushState(null, '', `?produto=${encodeURIComponent(produto.slug)}`)
        empilhou.current = true
    }
    const fechar = useCallback(() => {
        if (empilhou.current) {
            empilhou.current = false
            window.history.back()
        } else {
            window.history.replaceState(null, '', window.location.pathname)
        }
    }, [])

    const secoes = [
        { id: 'combos', rotulo: 'Combos da Black', tem: vitrine.combos.length > 0 },
        { id: 'massa', rotulo: 'Massa', tem: vitrine.massa.length > 0 },
        { id: 'doces', rotulo: 'Doces', tem: vitrine.doces.length > 0 },
        { id: 'zero', rotulo: 'Zero', tem: vitrine.zero.length > 0 },
    ].filter((s) => s.tem)

    const controle = (p: ProdutoLoja, larguraTotal = false) => {
        if (!p.disponivel) {
            return <span className="px-2 text-xs font-bold text-texto-suave">Esgotado</span>
        }
        const q = quantidadeDe(p.id)
        if (q === 0) {
            return (
                <button
                    type="button"
                    onClick={() => definirQuantidade(p.id, 1)}
                    className={cn(botaoAdicionar, larguraTotal && 'w-full')}
                >
                    Adicionar
                </button>
            )
        }
        return (
            <Seletor
                variante="loja"
                quantidade={q}
                onMenos={() => definirQuantidade(p.id, q - 1)}
                onMais={() => definirQuantidade(p.id, q + 1)}
                className={cn(larguraTotal && 'w-full justify-between')}
            />
        )
    }

    const linhaProduto = (p: ProdutoLoja) => (
        <article key={p.id} className="flex items-center gap-3 border-b border-linha py-2.5">
            <button
                type="button"
                aria-label={`Ver ${p.nome}`}
                onClick={() => abrir(p)}
                className="shrink-0 cursor-pointer rounded-xl"
            >
                <Foto url={p.imagemUrl} alt={p.nome} largura={56} className="h-14 w-14 rounded-xl" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold">{p.nome}</span>
                <div className="flex items-baseline gap-1.5">
                    {p.precoDe !== null && (
                        <span className="text-[11px] text-texto-suave line-through">{reais(p.precoDe)}</span>
                    )}
                    <span className="text-base font-bold">{reais(p.preco)}</span>
                </div>
            </div>
            {controle(p)}
        </article>
    )

    const cardCombo = (c: ComboLoja) => (
        <article key={c.id} className="flex gap-3 rounded-2xl border border-linha bg-white p-3">
            <Foto url={c.imagemUrl} alt={c.nome} largura={88} className="h-[88px] w-[88px] rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-bold">{c.nome}</span>
                {c.resumo && <span className="text-xs leading-[1.35] text-texto-suave">{c.resumo}</span>}
                <div className="mt-1 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="font-titulo text-[22px] leading-none">{reais(c.preco)}</span>
                        {c.ancora !== null && (
                            <span className="text-[11px] text-texto-suave">separado: a partir de {reais(c.ancora)}</span>
                        )}
                    </div>
                    <Link
                        href={`/combo/${c.slug}`}
                        className="flex h-10 items-center rounded-[20px] bg-laranja px-3.5 text-sm font-bold text-marrom no-underline"
                    >
                        Montar
                    </Link>
                </div>
            </div>
        </article>
    )

    const campanha = vitrine.campanha
    const hero = campanha ? vitrine.hero : null
    // "9 itens" só quando o combo está completo (fixos + grupos de escolha); sem grupos, só o nome.
    const fraseHero =
        hero && hero.montavel
            ? `${hero.nome}, ${hero.fixos.reduce((s, f) => s + f.quantidade, 0) + hero.grupos.reduce((s, g) => s + g.quantidade, 0)} itens.`
            : `${hero?.nome ?? ''}.`

    return (
        <div className="relative pb-[100px]">
            <header className="flex h-16 items-center justify-between border-b border-linha bg-creme px-4">
                <div className="flex items-center gap-2.5">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-areia">
                        <Image src="/logo-mont.png" alt="Mont" fill sizes="40px" className="object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-titulo text-xl leading-none tracking-[0.5px]">MONT</span>
                        <span className="text-xs font-bold text-verde">Pedidos 24h · entrega na rota</span>
                    </div>
                </div>
                <Link
                    href="/sacola"
                    aria-label={`Abrir sacola, ${resumo.quantidadeItens} itens`}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-linha"
                >
                    <IconeSacola />
                    {resumo.quantidadeItens > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-laranja text-xs font-bold text-marrom">
                            {resumo.quantidadeItens}
                        </span>
                    )}
                </Link>
            </header>

            {secoes.length > 0 && (
                <nav aria-label="Categorias" className="flex h-14 items-center gap-2 overflow-x-auto border-b border-linha px-4">
                    {secoes.map((s, i) => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            className={cn(
                                'flex h-9 shrink-0 items-center rounded-[18px] px-3.5 text-[13px] font-bold no-underline',
                                i === 0 ? 'bg-marrom text-creme' : 'bg-areia text-marrom',
                            )}
                        >
                            {s.rotulo}
                        </a>
                    ))}
                </nav>
            )}

            {campanha && hero && (
                <section className="relative m-4 flex gap-3 overflow-hidden rounded-[20px] bg-marrom p-5 text-creme">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <span className="text-[11px] font-bold tracking-[2px] text-laranja">
                            BLACK DA MONT · ATÉ {diaMesSP(campanha.fim)}
                        </span>
                        <span className="font-titulo text-[40px] leading-[0.95] uppercase">Despensa cheia</span>
                        <span className="font-apoio text-[22px] leading-[1.1] italic">{fraseHero}</span>
                        <span className="font-titulo text-4xl leading-none text-laranja">{reais(hero.preco)}</span>
                        <span className="text-xs text-linha">Preço no Pix. Cartão com a taxa da maquininha.</span>
                    </div>
                    <Foto
                        url={hero.imagemUrl}
                        alt={hero.nome}
                        largura={120}
                        escura
                        className="h-[170px] w-[120px] rounded-xl"
                    />
                </section>
            )}

            {vitrine.combos.length > 0 && (
                <section id="combos" className="flex scroll-mt-2 flex-col gap-3 px-4 pt-2">
                    <h2 className={cn(tituloSecao, 'mt-2')}>Combos da Black</h2>
                    {vitrine.combos.map(cardCombo)}
                </section>
            )}

            {vitrine.massa.length > 0 && (
                <section id="massa" className="flex scroll-mt-2 flex-col gap-3 px-4 pt-6">
                    <h2 className={tituloSecao}>Massa de pão de queijo</h2>
                    <span className="-mt-1.5 text-[13px] text-texto-suave">
                        Queijo Canastra de verdade. Parmesão e Meia Cura.
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {vitrine.massa.map((p) => (
                            <article
                                key={p.id}
                                className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-white p-2.5"
                            >
                                <button
                                    type="button"
                                    aria-label={`Ver ${p.nome}`}
                                    onClick={() => abrir(p)}
                                    className="cursor-pointer rounded-xl"
                                >
                                    <Foto url={p.imagemUrl} alt={p.nome} largura={170} className="h-[120px] w-full rounded-xl" />
                                </button>
                                <span className="text-sm leading-tight font-bold">{p.nome}</span>
                                {p.subtitulo && <span className="text-[11px] text-texto-suave">{p.subtitulo}</span>}
                                <div className="flex items-baseline gap-1.5">
                                    {p.precoDe !== null && (
                                        <span className="text-xs text-texto-suave line-through">{reais(p.precoDe)}</span>
                                    )}
                                    <span className="font-titulo text-[22px]">{reais(p.preco)}</span>
                                </div>
                                {controle(p, true)}
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {vitrine.doces.length > 0 && (
                <section id="doces" className="flex scroll-mt-2 flex-col gap-1 px-4 pt-6">
                    <h2 className={cn(tituloSecao, 'mb-1')}>Doces Duas Irmãs</h2>
                    <span className="mb-1 text-[13px] text-texto-suave">Potes de 680 g e 400 g · sabores conforme estoque</span>
                    {vitrine.doces.map(linhaProduto)}
                </section>
            )}

            {vitrine.zero.length > 0 && (
                <section id="zero" className="flex scroll-mt-2 flex-col gap-1 px-4 pt-6">
                    <h2 className={cn(tituloSecao, 'mb-1')}>Linha zero</h2>
                    <span className="mb-1 text-[13px] text-texto-suave">Zero adição de açúcares. Doce do mesmo jeito.</span>
                    {vitrine.zero.map(linhaProduto)}
                </section>
            )}

            <footer className="mx-4 mt-7 flex flex-col gap-2.5 border-t border-linha pt-5 text-[13px] text-texto-suave">
                <span>Entregamos no ABC e em São Paulo · frete pelo bairro.</span>
                <a href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener noreferrer" className="font-bold">
                    Falar com a Mont no WhatsApp
                </a>
                <a href="#privacidade">Política de privacidade</a>
            </footer>

            {resumo.quantidadeItens > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-[430px] px-3">
                    <Link
                        href="/sacola"
                        className="flex h-[60px] items-center justify-between rounded-[30px] bg-marrom pr-2 pl-5 text-creme no-underline shadow-[0_8px_24px_rgba(44,24,16,0.25)]"
                    >
                        <span className="text-[15px] font-bold text-creme">
                            Ver sacola · {resumo.quantidadeItens} {resumo.quantidadeItens === 1 ? 'item' : 'itens'}
                        </span>
                        <span className="flex h-11 items-center rounded-[22px] bg-laranja px-[18px] text-base font-bold text-marrom">
                            {reais(resumo.totalPix)}
                        </span>
                    </Link>
                </div>
            )}

            {produtoAberto && (
                <PainelProduto
                    key={produtoAberto.id}
                    produto={produtoAberto}
                    onFechar={fechar}
                    onAdicionar={(q) => {
                        adicionarProduto(produtoAberto.id, q)
                        fechar()
                    }}
                />
            )}
        </div>
    )
}
