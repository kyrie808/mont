import { instanteDeReferencia } from '@/lib/ambiente'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { fotoProvisoria } from './fotosProvisorias'
import { apareceNaLoja, montarVitrine, type PrecoCampanha } from './montar'
import type { Vitrine } from './tipos'

type Cliente = Awaited<ReturnType<typeof criarClienteServidor>>

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

async function precosDaCampanha(cliente: Cliente, campanhaId: string | null): Promise<Map<string, PrecoCampanha>> {
    const precos = new Map<string, PrecoCampanha>()
    if (!campanhaId) return precos
    const { data, error } = await cliente
        .from('loja_precos')
        .select('produto_id, preco_pix, preco_credito_1x')
        .eq('campanha_id', campanhaId)
    if (error) falha('os preços', error.message)
    for (const p of data ?? []) {
        precos.set(p.produto_id, { pix: p.preco_pix, credito: p.preco_credito_1x })
    }
    return precos
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

/** Lê o cadastro do sistema interno (produtos e seções da tela Catálogo) e monta a vitrine. */
export async function carregarVitrine(): Promise<Vitrine> {
    const cliente = await criarClienteServidor()

    const [campanha, produtosRes, secoesRes] = await Promise.all([
        campanhaVigente(cliente),
        cliente
            .from('produtos')
            .select(
                'id, codigo, nome, nome_loja, slug, subtitulo, descricao, preco, eh_combo, visivel_catalogo, esgotado, destaque, secao_id, ordem_vitrine, selo, beneficios, instrucoes_preparo',
            )
            .eq('ativo', true),
        cliente.from('cat_secoes').select('id, nome, slug, descricao').eq('ativa', true).order('ordem'),
    ])
    if (produtosRes.error) falha('os produtos', produtosRes.error.message)
    if (secoesRes.error) falha('as seções', secoesRes.error.message)

    const produtos = produtosRes.data ?? []
    const precos = await precosDaCampanha(cliente, campanha?.id ?? null)

    const aparecem = produtos.filter((p) => apareceNaLoja(p, precos))
    const comboIds = aparecem.filter((p) => p.eh_combo).map((p) => p.id)
    const [fixosRes, gruposRes] = await Promise.all([
        cliente
            .from('produto_componentes')
            .select('combo_id, quantidade, brinde, componente:produtos!produto_componentes_componente_id_fkey(id, nome)')
            .in('combo_id', comboIds),
        cliente
            .from('combo_grupos')
            .select(
                'id, combo_id, titulo, rotulo_singular, rotulo_plural, quantidade, permite_repetir, ordem, opcoes:combo_grupo_opcoes(produto_id, ordem, produto:produtos(nome))',
            )
            .in('combo_id', comboIds)
            .order('ordem'),
    ])
    if (fixosRes.error) falha('os itens fixos dos combos', fixosRes.error.message)
    if (gruposRes.error) falha('os grupos dos combos', gruposRes.error.message)

    const grupos = gruposRes.data ?? []
    const idsComFoto = new Set<string>(aparecem.map((p) => p.id))
    for (const g of grupos) for (const o of g.opcoes) idsComFoto.add(o.produto_id)
    const imagens = await imagensPorProduto(cliente, [...idsComFoto])

    return montarVitrine({
        campanha: campanha ? { nome: campanha.nome, fim: campanha.fim } : null,
        produtos,
        secoes: secoesRes.data ?? [],
        precos,
        fixos: fixosRes.data ?? [],
        grupos,
        imagens,
        fotoProvisoria,
    })
}
