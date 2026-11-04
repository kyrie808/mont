import { cache } from 'react'
import { instanteDeReferencia } from '@/lib/ambiente'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { fotoProvisoria } from './fotosProvisorias'
import { apareceNaLoja, fotosEmOrdem, montarVitrine, type PrecoCampanha } from './montar'
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

/** Preços da campanha vigente, por produto. Vazio fora de campanha. */
function precosDaCampanha(
    linhas: { campanha_id: string; produto_id: string; preco_pix: number; preco_credito_1x: number }[],
    campanhaId: string | null,
): Map<string, PrecoCampanha> {
    const precos = new Map<string, PrecoCampanha>()
    if (!campanhaId) return precos
    for (const p of linhas) {
        if (p.campanha_id === campanhaId) precos.set(p.produto_id, { pix: p.preco_pix, credito: p.preco_credito_1x })
    }
    return precos
}

/**
 * Lê o cadastro do sistema interno (produtos e seções da tela Catálogo) e monta a vitrine.
 * Tudo numa rodada só, em paralelo (as tabelas são pequenas, e o servidor fica longe do banco):
 * cada consulta encadeada somava uma ida e volta antes de o HTML com as fotos chegar ao celular.
 */
export async function carregarVitrine(): Promise<Vitrine> {
    const cliente = await criarClienteServidor()

    const [campanha, produtosRes, secoesRes, precosRes, fixosRes, gruposRes, imagensRes] = await Promise.all([
        campanhaVigente(cliente),
        cliente
            .from('produtos')
            .select(
                'id, codigo, nome, nome_loja, slug, subtitulo, descricao, categoria, preco, eh_combo, visivel_catalogo, esgotado, destaque, secao_id, ordem_vitrine, selo, beneficios, instrucoes_preparo',
            )
            .eq('ativo', true),
        cliente.from('cat_secoes').select('id, nome, slug, descricao').eq('ativa', true).order('ordem'),
        cliente.from('loja_precos').select('campanha_id, produto_id, preco_pix, preco_credito_1x'),
        cliente
            .from('produto_componentes')
            .select('combo_id, quantidade, brinde, componente:produtos!produto_componentes_componente_id_fkey(id, nome)'),
        cliente
            .from('combo_grupos')
            .select(
                'id, combo_id, titulo, rotulo_singular, rotulo_plural, quantidade, permite_repetir, ordem, opcoes:combo_grupo_opcoes(produto_id, ordem, produto:produtos(nome))',
            )
            .order('ordem'),
        cliente.from('cat_imagens_produto').select('produto_id, url, tipo, ordem').eq('ativo', true).order('ordem'),
    ])
    if (produtosRes.error) falha('os produtos', produtosRes.error.message)
    if (secoesRes.error) falha('as seções', secoesRes.error.message)
    if (precosRes.error) falha('os preços', precosRes.error.message)
    if (fixosRes.error) falha('os itens fixos dos combos', fixosRes.error.message)
    if (gruposRes.error) falha('os grupos dos combos', gruposRes.error.message)
    if (imagensRes.error) falha('as fotos', imagensRes.error.message)

    const produtos = produtosRes.data ?? []
    const precos = precosDaCampanha(precosRes.data ?? [], campanha?.id ?? null)
    const comboIds = new Set(produtos.filter((p) => p.eh_combo && apareceNaLoja(p, precos)).map((p) => p.id))

    return montarVitrine({
        campanha: campanha ? { nome: campanha.nome, fim: campanha.fim } : null,
        produtos,
        secoes: secoesRes.data ?? [],
        precos,
        fixos: (fixosRes.data ?? []).filter((f) => comboIds.has(f.combo_id)),
        grupos: (gruposRes.data ?? []).filter((g) => comboIds.has(g.combo_id)),
        imagens: fotosEmOrdem(imagensRes.data ?? []),
        fotoProvisoria,
    })
}

/** A mesma vitrine para os metadados e a página na mesma requisição (uma leitura só). */
export const vitrineDaRequisicao = cache(carregarVitrine)
