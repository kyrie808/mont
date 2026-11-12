'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@mont/shared'
import { PrecoCombo } from '@/components/combo/PrecoCombo'
import { BotaoAvisa, FaixaEsgotado, fotoEsgotada } from '@/components/Esgotado'
import { Foto } from '@/components/Foto'
import { IconeSacola } from '@/components/IconeSacola'
import { Seletor } from '@/components/Seletor'
import { diaMesSP, linkWhatsApp, reais } from '@/lib/formato'
import { medirAdicao } from '@/lib/medicao/dataLayer'
import { catalogoDa, resumirSacola, totalDeItens } from '@/lib/sacola/calculo'
import { useSacola } from '@/lib/sacola/store'
import { useSacolaPronta } from '@/lib/sacola/useSacolaPronta'
import { cartaoTemOutroPreco, MESMO_PRECO } from '@/lib/vitrine/cartao'
import { separarEsgotados } from '@/lib/vitrine/esgotado'
import { ehCombo, type ComboLoja, type ProdutoLoja, type SecaoLoja, type Vitrine } from '@/lib/vitrine/tipos'
import { PainelProduto } from './PainelProduto'

interface LojaProps {
    vitrine: Vitrine
    whatsapp: string
}

const tituloSecao = 'font-titulo text-[26px] font-normal uppercase tracking-[0.5px]'
// Selo do cadastro ("Mais vendido", "Oferta", "Queridinho").
const seloClasse = 'rounded-full bg-areia px-2 py-0.5 text-[11px] leading-tight font-bold text-marrom'
const botaoAdicionar =
    'h-11 cursor-pointer rounded-[22px] border-[1.5px] border-marrom bg-creme px-4 text-sm font-bold text-marrom'

/** Tela 01: a loja em página única. */
export function Loja({ vitrine, whatsapp }: LojaProps) {
    const pronta = useSacolaPronta()
    const itens = useSacola((s) => s.itens)
    const definirQuantidade = useSacola((s) => s.definirQuantidade)
    const adicionarCombo = useSacola((s) => s.adicionarCombo)
    const removerCombo = useSacola((s) => s.removerCombo)

    const catalogo = useMemo(() => catalogoDa(vitrine), [vitrine])
    const resumo = useMemo(() => resumirSacola(pronta ? itens : [], catalogo), [pronta, itens, catalogo])

    // Para onde vai o foco quando o botão some ("Adicionar" ↔ "− 1 +"): sem isso ele cai no <body>.
    const [foco, setFoco] = useState<{ id: string; alvo: 'mais' | 'adicionar' } | null>(null)

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

    // Aberto pelo teclado (Enter/Espaço: detail 0) o foco vai para o "×"; pelo toque, para o painel, sem contorno.
    const [abertoPorTeclado, setAbertoPorTeclado] = useState(false)
    const abrir = (produto: ProdutoLoja, evento: React.MouseEvent) => {
        setAbertoPorTeclado(evento.detail === 0)
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

    // Abas: os combos da campanha (se houver) e as seções da tela Catálogo do sistema interno.
    const secoes = useMemo(
        () => [
            ...(vitrine.combos.length > 0 ? [{ id: 'combos', rotulo: 'Combos da Black' }] : []),
            ...vitrine.secoes.map((s) => ({ id: s.id, rotulo: s.nome })),
        ],
        [vitrine],
    )

    // Aba ativa acompanha a rolagem: a seção que cruza a faixa logo abaixo das abas fixas.
    const [secaoAtiva, setSecaoAtiva] = useState<string | undefined>(secoes[0]?.id)
    useEffect(() => {
        const alvos = secoes.flatMap((s) => {
            const el = document.getElementById(s.id)
            return el ? [el] : []
        })
        const observador = new IntersectionObserver(
            (entradas) => {
                const visivel = entradas
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
                if (visivel) setSecaoAtiva(visivel.target.id)
            },
            { rootMargin: '-64px 0px -65% 0px' },
        )
        alvos.forEach((el) => observador.observe(el))
        return () => observador.disconnect()
    }, [secoes])

    const controle = (p: ProdutoLoja, larguraTotal = false) => {
        if (!p.disponivel) {
            return <span className="px-2 text-xs font-bold text-texto-suave">Esgotado</span>
        }
        const q = quantidadeDe(p.id)
        if (q === 0) {
            return (
                <button
                    type="button"
                    aria-label={`Adicionar ${p.nome}`}
                    autoFocus={foco?.id === p.id && foco.alvo === 'adicionar'}
                    onClick={() => {
                        definirQuantidade(p.id, 1)
                        medirAdicao(p)
                        setFoco({ id: p.id, alvo: 'mais' })
                    }}
                    className={cn(botaoAdicionar, larguraTotal && 'w-full')}
                >
                    Adicionar
                </button>
            )
        }
        return (
            <Seletor
                variante="loja"
                nome={p.nome}
                quantidade={q}
                onMenos={() => {
                    if (q === 1) setFoco({ id: p.id, alvo: 'adicionar' })
                    definirQuantidade(p.id, q - 1)
                }}
                onMais={() => {
                    definirQuantidade(p.id, q + 1)
                    medirAdicao(p)
                }}
                focarMais={foco?.id === p.id && foco.alvo === 'mais'}
                animar
                className={cn(larguraTotal && 'w-full justify-between')}
            />
        )
    }

    // Combo sem escolha (ex.: Dupla Zero): vai direto para a sacola, sem a tela de montar.
    // Cada unidade é um combo na sacola; o "−" tira a última.
    const controleComboFixo = (c: ComboLoja) => {
        if (!c.disponivel || !c.montavel) {
            return <span className="px-2 text-xs font-bold text-texto-suave">Esgotado</span>
        }
        const naSacola = pronta ? itens.filter((i) => i.tipo === 'combo' && i.comboId === c.id) : []
        const q = naSacola.length
        if (q === 0) {
            return (
                <button
                    type="button"
                    aria-label={`Adicionar ${c.nome}`}
                    autoFocus={foco?.id === c.id && foco.alvo === 'adicionar'}
                    onClick={() => {
                        adicionarCombo(c.id, [])
                        medirAdicao(c)
                        setFoco({ id: c.id, alvo: 'mais' })
                    }}
                    className="flex h-11 cursor-pointer items-center rounded-[22px] bg-laranja px-4 text-sm font-bold text-marrom"
                >
                    Adicionar
                </button>
            )
        }
        const ultimo = naSacola[naSacola.length - 1]
        return (
            <Seletor
                variante="loja"
                nome={c.nome}
                quantidade={q}
                onMenos={() => {
                    if (q === 1) setFoco({ id: c.id, alvo: 'adicionar' })
                    if (ultimo?.tipo === 'combo') removerCombo(ultimo.chave)
                }}
                onMais={() => {
                    adicionarCombo(c.id, [])
                    medirAdicao(c)
                }}
                maisDesabilitado={q >= 99}
                focarMais={foco?.id === c.id && foco.alvo === 'mais'}
                animar
            />
        )
    }

    // Foto, nome e preço abrem o produto juntos (alvo grande); o botão da direita só põe na sacola.
    const linhaProduto = (p: ProdutoLoja) => (
        <article key={p.id} className="flex items-center gap-3 border-b border-linha py-2.5">
            <button
                type="button"
                onClick={(e) => abrir(p, e)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-left"
            >
                <Foto url={p.imagemUrl} alt="" largura={56} className="h-14 w-14 shrink-0 rounded-xl" />
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm leading-tight font-bold">{p.nome}</span>
                    {/* Preço atual primeiro: nem todo produto tem o riscado, e assim a coluna do preço fica alinhada. */}
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold">{reais(p.preco)}</span>
                        {p.precoDe !== null && (
                            <span className="text-[11px] text-texto-suave line-through">{reais(p.precoDe)}</span>
                        )}
                        {p.selo && <span className={cn(seloClasse, 'self-center')}>{p.selo}</span>}
                    </span>
                </span>
            </button>
            {controle(p)}
        </article>
    )

    // Esgotado na lista: miniatura cinza com a faixa, "Volta em breve" no lugar do preço e o "Me avisa".
    const linhaEsgotada = (p: ProdutoLoja) => (
        <article key={p.id} className="flex items-center gap-3 border-b border-linha py-2.5">
            <button
                type="button"
                onClick={(e) => abrir(p, e)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-left"
            >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                    <Foto url={p.imagemUrl} alt="" largura={56} className={cn('h-14 w-14', fotoEsgotada)} />
                    <FaixaEsgotado tamanho="linha" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-2 text-sm leading-tight font-bold text-texto-suave">{p.nome}</span>
                    <span className="text-xs text-texto-suave">Volta em breve</span>
                </span>
            </button>
            <BotaoAvisa produto={p} whatsapp={whatsapp} variante="linha" />
        </article>
    )

    // Seção com poucos produtos: cartões com foto grande, preço e botão alinhados no pé.
    const cartaoProduto = (p: ProdutoLoja, prioridade: boolean) => (
        <article key={p.id} className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-white p-2.5">
            <button
                type="button"
                onClick={(e) => abrir(p, e)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl text-left"
            >
                <span className="relative">
                    <Foto
                        url={p.imagemUrl}
                        alt=""
                        largura={170}
                        prioridade={prioridade}
                        className="h-[120px] w-full rounded-xl"
                    />
                    {p.selo && <span className={cn(seloClasse, 'absolute top-2 left-2')}>{p.selo}</span>}
                </span>
                <span className="text-sm leading-tight font-bold">{p.nome}</span>
                {p.subtitulo && <span className="text-xs leading-snug text-texto-suave">{p.subtitulo}</span>}
            </button>
            {/* Preço e botão alinhados no pé do card, mesmo com nomes de tamanhos diferentes. */}
            <div className="mt-auto flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1.5">
                    {p.precoDe !== null && (
                        <span className="text-xs text-texto-suave line-through">{reais(p.precoDe)}</span>
                    )}
                    <span className="font-titulo text-[22px]">{reais(p.preco)}</span>
                </div>
                {controle(p, true)}
            </div>
        </article>
    )

    // Esgotado em grade: fundo mais apagado, foto cinza com a faixa, "Volta em breve" e o "Me avisa quando chegar".
    const cartaoEsgotado = (p: ProdutoLoja) => (
        <article key={p.id} className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-esgotado p-2.5">
            <button
                type="button"
                onClick={(e) => abrir(p, e)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl text-left"
            >
                <span className="relative h-[120px] w-full overflow-hidden rounded-xl">
                    <Foto url={p.imagemUrl} alt="" largura={170} className={cn('h-[120px] w-full', fotoEsgotada)} />
                    <FaixaEsgotado tamanho="cartao" />
                </span>
                <span className="text-sm leading-tight font-bold text-texto-suave">{p.nome}</span>
                {p.subtitulo && <span className="text-xs leading-snug text-texto-suave">{p.subtitulo}</span>}
            </button>
            <div className="mt-auto flex flex-col gap-1.5">
                <span className="text-xs text-texto-suave">Volta em breve</span>
                <BotaoAvisa produto={p} whatsapp={whatsapp} variante="cartao" />
            </div>
        </article>
    )

    // Divisor antes dos esgotados de uma seção em lista (só aparece se a seção tiver algum). Na grade, não há divisor.
    const divisorEsgotados = (
        <div className="mt-[18px] mb-0.5 flex items-center gap-2">
            <span className="text-xs font-bold tracking-[1.5px] text-texto-suave uppercase">Esgotados no momento</span>
            <span aria-hidden="true" className="h-px flex-1 bg-linha" />
        </div>
    )

    const secaoDaLoja = (s: SecaoLoja, primeira: boolean) => {
        const combosDaSecao = s.itens.filter(ehCombo)
        // Esgotados no fim da seção: na grade, como últimos cards; na lista, depois do divisor.
        const { aVenda, esgotados } = separarEsgotados(s.itens.filter((p) => !ehCombo(p)))
        return (
            <section
                key={s.id}
                id={s.id}
                className={cn('flex scroll-mt-16 flex-col px-4 pt-6', s.formato === 'cartoes' ? 'gap-3' : 'gap-1')}
            >
                <h2 className={cn(tituloSecao, s.formato === 'lista' && 'mb-1')}>{s.nome}</h2>
                {s.descricao && (
                    <span className={cn('text-[13px] text-texto-suave', s.formato === 'lista' ? 'mb-1' : '-mt-1.5')}>
                        {s.descricao}
                    </span>
                )}
                {combosDaSecao.length > 0 && <div className="flex flex-col gap-3">{combosDaSecao.map(cardCombo)}</div>}
                {s.formato === 'cartoes' ? (
                    <div className="grid grid-cols-2 gap-3">
                        {/* Sem combos da campanha no topo, as 2 primeiras fotos da 1ª seção são o maior conteúdo da tela. */}
                        {aVenda.map((p, i) => cartaoProduto(p, primeira && i < 2))}
                        {esgotados.map(cartaoEsgotado)}
                    </div>
                ) : (
                    <>
                        {aVenda.map(linhaProduto)}
                        {esgotados.length > 0 && (
                            <>
                                {divisorEsgotados}
                                {esgotados.map(linhaEsgotada)}
                            </>
                        )}
                    </>
                )}
            </section>
        )
    }

    const cardCombo = (c: ComboLoja) => (
        <article key={c.id} className="flex gap-3 rounded-2xl border border-linha bg-white p-3">
            <Foto url={c.imagemUrl} alt={c.nome} largura={88} className="h-[88px] w-[88px] rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-base font-bold">{c.nome}</span>
                {c.resumo && <span className="text-xs leading-[1.35] text-texto-suave">{c.resumo}</span>}
                <div className="mt-1 flex items-end justify-between gap-2">
                    <PrecoCombo combo={c} variante="card" />
                    {c.grupos.length === 0 ? (
                        controleComboFixo(c)
                    ) : (
                        <Link
                            href={`/combo/${c.slug}`}
                            className="flex h-11 items-center rounded-[22px] bg-laranja px-4 text-sm font-bold text-marrom no-underline"
                        >
                            Montar
                        </Link>
                    )}
                </div>
            </div>
        </article>
    )

    const campanha = vitrine.campanha
    const hero = campanha ? vitrine.hero : null
    // "Combo Família, 9 itens.": a composição é fixa; só os sabores podem estar pendentes.
    const fraseHero = hero ? `${hero.nome}, ${totalDeItens(hero)} itens.` : ''

    return (
        <div className="relative pb-[100px]">
            <header className="flex h-16 items-center justify-between border-b border-linha bg-creme px-4">
                <div className="flex items-center gap-2.5">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full bg-areia">
                        <Image src="/logo-mont-120.webp" alt="Mont" fill sizes="40px" className="object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-titulo text-xl leading-none tracking-[0.5px]">MONT</span>
                        <span className="text-xs font-bold text-verde">Pedidos 24h · entrega na rota</span>
                    </div>
                </div>
                <Link
                    href="/sacola"
                    aria-label={`Abrir sacola, ${resumo.quantidadeItens} ${resumo.quantidadeItens === 1 ? 'item' : 'itens'}`}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-linha"
                >
                    <IconeSacola />
                    {resumo.quantidadeItens > 0 && (
                        // key: a cada mudança o selo remonta e pulsa (feedback de "entrou na sacola").
                        <span
                            key={resumo.quantidadeItens}
                            className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-laranja text-xs font-bold text-marrom motion-safe:animate-pulsar"
                        >
                            {resumo.quantidadeItens}
                        </span>
                    )}
                </Link>
            </header>

            {secoes.length > 0 && (
                <nav
                    aria-label="Categorias"
                    className="sticky top-0 z-30 flex h-14 items-center gap-2 overflow-x-auto border-b border-linha bg-creme px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {secoes.map((s) => (
                        <a
                            key={s.id}
                            href={`#${s.id}`}
                            aria-current={s.id === secaoAtiva ? 'true' : undefined}
                            onClick={() => setSecaoAtiva(s.id)}
                            className={cn(
                                'flex h-11 shrink-0 items-center rounded-[22px] px-4 text-[13px] font-bold no-underline transition-colors duration-150',
                                s.id === secaoAtiva ? 'bg-marrom text-creme' : 'bg-areia text-marrom hover:bg-linha',
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
                        <PrecoCombo combo={hero} variante="banner" />
                        <span className="text-xs text-linha">
                            {cartaoTemOutroPreco(hero) ? 'Preço no Pix. Cartão com a taxa da maquininha.' : MESMO_PRECO}
                        </span>
                    </div>
                    <Foto
                        url={hero.imagemUrl}
                        alt={hero.nome}
                        largura={120}
                        escura
                        prioridade
                        className="h-[170px] w-[120px] rounded-xl"
                    />
                </section>
            )}

            {vitrine.combos.length > 0 && (
                <section id="combos" className="flex scroll-mt-16 flex-col gap-3 px-4 pt-2">
                    <h2 className={cn(tituloSecao, 'mt-2')}>Combos da Black</h2>
                    {vitrine.combos.map(cardCombo)}
                </section>
            )}

            {vitrine.secoes.map((s, i) => secaoDaLoja(s, i === 0 && vitrine.combos.length === 0))}

            {/* Só texto (sem foto nem script): não pesa no celular. /sobre do catálogo antigo cai aqui. */}
            <section id="quem-somos" aria-labelledby="titulo-quem-somos" className="mx-4 mt-8 flex scroll-mt-16 flex-col gap-2.5">
                <h2 id="titulo-quem-somos" className={tituloSecao}>
                    Quem somos
                </h2>
                <p className="text-[15px] leading-relaxed">
                    A Mont nasceu na cozinha de casa, em São Bernardo, com uma escolha simples: usar Queijo Canastra de
                    verdade. Parmesão e Meia Cura, sem conservante. Pão de queijo que não é oco e não murcha.
                </p>
                <p className="text-[15px] leading-relaxed">Junto vêm os doces mineiros Duas Irmãs, para completar a mesa.</p>
                <p className="text-[15px] leading-relaxed">Entregamos em todo o ABC e em São Paulo.</p>
                <p className="text-sm leading-relaxed text-marrom-medio">
                    <strong className="font-bold text-marrom">Como funciona:</strong> monte seu pedido · envie pelo WhatsApp ·
                    receba em casa ou retire na Mont.
                </p>
            </section>

            <footer className="mx-4 mt-7 flex flex-col gap-2.5 border-t border-linha pt-5 text-[13px] text-texto-suave">
                <span>Entregamos no ABC e em São Paulo · frete pelo bairro.</span>
                <a href={linkWhatsApp(whatsapp)} target="_blank" rel="noopener noreferrer" className="font-bold">
                    Falar com a Mont no WhatsApp
                </a>
                <Link href="/privacidade">Política de privacidade</Link>
            </footer>

            {resumo.quantidadeItens > 0 && (
                <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-[430px] px-3 motion-safe:animate-subir motion-reduce:animate-surgir">
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

            {/* Leitor de tela: anuncia a sacola mudando (o selo e a barra são só visuais). */}
            <p role="status" className="sr-only">
                {pronta && resumo.quantidadeItens > 0
                    ? `${resumo.quantidadeItens} ${resumo.quantidadeItens === 1 ? 'item' : 'itens'} na sacola, ${reais(resumo.totalPix)}`
                    : ''}
            </p>

            {produtoAberto && (
                <PainelProduto
                    key={produtoAberto.id}
                    produto={produtoAberto}
                    whatsapp={whatsapp}
                    naSacola={quantidadeDe(produtoAberto.id)}
                    focarFechar={abertoPorTeclado}
                    onFechar={fechar}
                    onConfirmar={(q) => {
                        medirAdicao(produtoAberto, q - quantidadeDe(produtoAberto.id))
                        definirQuantidade(produtoAberto.id, q)
                        fechar()
                    }}
                />
            )}
        </div>
    )
}
