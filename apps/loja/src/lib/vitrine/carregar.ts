import { instanteDeReferencia } from '@/lib/ambiente'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { BairroFrete, ComboLoja, GrupoCombo, ItemFixo, ProdutoLoja, Secao, Vitrine } from './tipos'

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>

const SECOES: readonly string[] = ['combos', 'massa', 'doces', 'zero'] satisfies Secao[]

function ehSecao(valor: string): valor is Secao {
    return SECOES.includes(valor)
}

/**
 * Doce só está à venda se houver estoque livre.
 * Na Fase 1 ainda não existem pedidos da loja, então nada está reservado;
 * a Fase 2 passa a descontar o reservado (pedidos aguardando pagamento e pagos não entregues).
 */
function temEstoqueLivre(estoqueAtual: number | null): boolean {
    return (estoqueAtual ?? 0) > 0
}

function falha(contexto: string, mensagem: string): never {
    throw new Error(`Loja: falha ao ler ${contexto} (${mensagem})`)
}

async function campanhaVigente(cliente: Cliente) {
    const agora = instanteDeReferencia().toISOString()
    const { data, error } = await cliente
        .from('loja_campanhas')
        .select('id, nome, fim')
        .eq('ativa', true)
        .lte('inicio', agora)
        .gte('fim', agora)
        .order('inicio', { ascending: false })
        .limit(1)
        .maybeSingle()
    if (error) falha('a campanha', error.message)
    return data
}

/** Capa ativa de cada produto (a "cover" primeiro; senão, a de menor ordem). */
async function imagensPorProduto(cliente: Cliente, ids: string[]): Promise<Map<string, string>> {
    const mapa = new Map<string, string>()
    if (ids.length === 0) return mapa
    const { data, error } = await cliente
        .from('cat_imagens_produto')
        .select('produto_id, url, tipo, ordem')
        .in('produto_id', ids)
        .eq('ativo', true)
        .order('ordem')
    if (error) falha('as fotos', error.message)
    const capas = new Map<string, string>()
    for (const img of data ?? []) {
        if (!img.produto_id) continue
        if (!mapa.has(img.produto_id)) mapa.set(img.produto_id, img.url)
        if (img.tipo === 'cover' && !capas.has(img.produto_id)) capas.set(img.produto_id, img.url)
    }
    for (const [id, url] of capas) mapa.set(id, url)
    return mapa
}

export async function carregarVitrine(): Promise<Vitrine> {
    const cliente = await criarClienteServidor()
    const campanha = await campanhaVigente(cliente)

    const { data: linhas, error: erroVitrine } = await cliente
        .from('loja_vitrine')
        .select(
            'produto_id, secao, ordem, disponivel, usa_estoque, destaque_hero, leva_junto, nome_loja, resumo, produto:produtos!inner(id, nome, slug, subtitulo, descricao, preco, estoque_atual, eh_combo, ativo)',
        )
        .eq('visivel', true)
        .order('ordem')
    if (erroVitrine) falha('a vitrine', erroVitrine.message)

    const precos = new Map<string, { pix: number; credito: number; ancora: number | null }>()
    if (campanha) {
        const { data, error } = await cliente
            .from('loja_precos')
            .select('produto_id, preco_pix, preco_credito_1x, ancora')
            .eq('campanha_id', campanha.id)
        if (error) falha('os preços', error.message)
        for (const p of data ?? []) {
            precos.set(p.produto_id, { pix: p.preco_pix, credito: p.preco_credito_1x, ancora: p.ancora })
        }
    }

    // Só produtos ativos e de seção conhecida (o guard estreita o tipo de `secao`).
    const ativas = (linhas ?? []).flatMap((l) => {
        const secao = l.secao
        return l.produto.ativo && ehSecao(secao) ? [{ ...l, secao }] : []
    })
    const comboIds = ativas.filter((l) => l.produto.eh_combo).map((l) => l.produto_id)

    const [fixosRes, gruposRes] = await Promise.all([
        cliente
            .from('produto_componentes')
            .select('combo_id, quantidade, componente:produtos!produto_componentes_componente_id_fkey(id, nome, ativo)')
            .in('combo_id', comboIds),
        cliente
            .from('combo_grupos')
            .select(
                'id, combo_id, titulo, rotulo_singular, rotulo_plural, quantidade, permite_repetir, ordem, opcoes:combo_grupo_opcoes(produto_id, ordem, produto:produtos(id, nome, estoque_atual, ativo))',
            )
            .in('combo_id', comboIds)
            .order('ordem'),
    ])
    if (fixosRes.error) falha('os itens fixos dos combos', fixosRes.error.message)
    if (gruposRes.error) falha('os grupos dos combos', gruposRes.error.message)

    const idsComFoto = new Set<string>(ativas.map((l) => l.produto_id))
    for (const g of gruposRes.data ?? []) for (const o of g.opcoes) idsComFoto.add(o.produto_id)
    const imagens = await imagensPorProduto(cliente, [...idsComFoto])

    // Disponibilidade (decisão P5): chave manual; doces também exigem estoque livre.
    const disponivelNaVitrine = new Map<string, boolean>()
    // Nome de exibição (loja_vitrine.nome_loja) vale também nos itens fixos e nos sabores dos combos.
    const nomeNaLoja = new Map<string, string>()
    for (const l of ativas) {
        disponivelNaVitrine.set(l.produto_id, l.disponivel && (!l.usa_estoque || temEstoqueLivre(l.produto.estoque_atual)))
        nomeNaLoja.set(l.produto_id, l.nome_loja ?? l.produto.nome)
    }

    const produtoDaLinha = (l: (typeof ativas)[number]): ProdutoLoja => {
        const preco = precos.get(l.produto_id)
        return {
            id: l.produto_id,
            slug: l.produto.slug,
            nome: nomeNaLoja.get(l.produto_id) ?? l.produto.nome,
            subtitulo: l.produto.subtitulo,
            descricao: l.produto.descricao,
            imagemUrl: imagens.get(l.produto_id) ?? null,
            secao: l.secao,
            preco: preco ? preco.pix : l.produto.preco,
            precoDe: preco && l.produto.preco > preco.pix ? l.produto.preco : null,
            precoCredito: preco ? preco.credito : null,
            disponivel: disponivelNaVitrine.get(l.produto_id) ?? false,
        }
    }

    const fixosPorCombo = new Map<string, ItemFixo[]>()
    const fixosDisponiveis = new Map<string, boolean>()
    for (const f of fixosRes.data ?? []) {
        const lista = fixosPorCombo.get(f.combo_id) ?? []
        lista.push({
            produtoId: f.componente.id,
            nome: nomeNaLoja.get(f.componente.id) ?? f.componente.nome,
            quantidade: f.quantidade,
        })
        fixosPorCombo.set(f.combo_id, lista)
        const ok = disponivelNaVitrine.get(f.componente.id) ?? f.componente.ativo
        fixosDisponiveis.set(f.combo_id, (fixosDisponiveis.get(f.combo_id) ?? true) && ok)
    }

    const gruposPorCombo = new Map<string, GrupoCombo[]>()
    for (const g of gruposRes.data ?? []) {
        const opcoes = [...g.opcoes]
            .sort((a, b) => a.ordem - b.ordem)
            .map((o) => ({
                produtoId: o.produto_id,
                nome: nomeNaLoja.get(o.produto_id) ?? o.produto.nome,
                imagemUrl: imagens.get(o.produto_id) ?? null,
                disponivel:
                    disponivelNaVitrine.get(o.produto_id) ?? (o.produto.ativo && temEstoqueLivre(o.produto.estoque_atual)),
            }))
        const lista = gruposPorCombo.get(g.combo_id) ?? []
        lista.push({
            id: g.id,
            titulo: g.titulo,
            rotuloSingular: g.rotulo_singular,
            rotuloPlural: g.rotulo_plural,
            quantidade: g.quantidade,
            permiteRepetir: g.permite_repetir,
            opcoes,
        })
        gruposPorCombo.set(g.combo_id, lista)
    }

    const combos: ComboLoja[] = []
    let hero: ComboLoja | null = null
    const avulsos: Record<Exclude<Secao, 'combos'>, ProdutoLoja[]> = { massa: [], doces: [], zero: [] }
    let levaJunto: ProdutoLoja | null = null

    for (const l of ativas) {
        const base = produtoDaLinha(l)
        if (l.produto.eh_combo) {
            // Combo só existe dentro da campanha, com preço próprio.
            const preco = precos.get(l.produto_id)
            if (!preco) continue
            const grupos = gruposPorCombo.get(l.produto_id) ?? []
            const fixos = fixosPorCombo.get(l.produto_id) ?? []
            // Combo só de itens fixos (ex.: Dupla Zero) vai direto para a sacola.
            // Com grupos, cada grupo precisa de sabores livres suficientes; grupo sem sabores = "em definição".
            const montavel =
                grupos.length === 0
                    ? fixos.length > 0
                    : grupos.every((g) => {
                          const livres = g.opcoes.filter((o) => o.disponivel).length
                          return g.permiteRepetir ? livres >= 1 : livres >= g.quantidade
                      })
            const combo: ComboLoja = {
                ...base,
                precoDe: null,
                disponivel: base.disponivel && (fixosDisponiveis.get(l.produto_id) ?? true),
                resumo: l.resumo,
                ancora: preco.ancora,
                fixos,
                grupos,
                montavel,
            }
            combos.push(combo)
            if (l.destaque_hero) hero = combo
            continue
        }
        if (base.secao === 'combos') continue
        avulsos[base.secao].push(base)
        if (l.leva_junto) levaJunto = base
    }

    return {
        campanha: campanha ? { nome: campanha.nome, fim: campanha.fim } : null,
        hero,
        combos,
        massa: avulsos.massa,
        doces: avulsos.doces,
        zero: avulsos.zero,
        levaJunto,
    }
}

export async function carregarBairros(): Promise<BairroFrete[]> {
    const cliente = await criarClienteServidor()
    const { data, error } = await cliente
        .from('loja_frete_bairros')
        .select('id, bairro, cidade, valor')
        .eq('ativo', true)
        .order('cidade')
        .order('bairro')
    if (error) falha('os bairros de entrega', error.message)
    return (data ?? []).map((b) => ({
        id: b.id,
        rotulo: b.bairro ? `${b.bairro} · ${b.cidade}` : b.cidade,
        valor: b.valor,
    }))
}
