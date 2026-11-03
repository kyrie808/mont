import type { SeloVariant } from '@mont/shared'
import type { ComboLoja, GrupoCombo, ItemFixo, ProdutoLoja, SecaoLoja, Vitrine } from './tipos'

// Monta a vitrine a partir do CADASTRO do sistema interno (função pura; as consultas ficam em carregar.ts).
// Regra (Parte A da paridade, 02/11/2026):
// - aparece o produto ativo com "Visível no catálogo"; combo de campanha aparece durante a campanha;
// - abas = seções ativas da tela Catálogo, na ordem de lá; sem seção (ou seção desligada) = "Mais produtos";
// - loja_vitrine é complemento opcional: nome, frase, seção/ordem só da loja, destaque, "leva junto?", esgotado.

export interface LinhaProduto {
    id: string
    codigo: string
    nome: string
    slug: string
    subtitulo: string | null
    descricao: string | null
    preco: number
    preco_ancoragem: number | null
    estoque_atual: number | null
    eh_combo: boolean
    visivel_catalogo: boolean
    secao_id: string | null
    ordem_vitrine: number
    selo: string | null
    beneficios: string | null
    instrucoes_preparo: string | null
}

/** Linha de loja_vitrine que vale (visivel = true; a leitura pública só enxerga essas). */
export interface LinhaVitrine {
    produto_id: string
    secao_id: string | null
    ordem_loja: number | null
    disponivel: boolean
    usa_estoque: boolean
    destaque_hero: boolean
    leva_junto: boolean
    nome_loja: string | null
    resumo: string | null
    frase_card: string | null
}

export interface LinhaSecao {
    id: string
    nome: string
    slug: string
}

export interface PrecoCampanha {
    pix: number
    credito: number
    ancora: number | null
}

export interface LinhaFixo {
    combo_id: string
    quantidade: number
    brinde: boolean
    componente: { id: string; nome: string }
}

export interface LinhaGrupo {
    id: string
    combo_id: string
    titulo: string
    rotulo_singular: string
    rotulo_plural: string
    quantidade: number
    permite_repetir: boolean
    opcoes: { produto_id: string; ordem: number; produto: { nome: string } }[]
}

export interface DadosVitrine {
    campanha: { nome: string; fim: string } | null
    /** Produtos ATIVOS do cadastro (visíveis ou não: os escondidos ainda podem ser item de combo). */
    produtos: LinhaProduto[]
    vitrine: LinhaVitrine[]
    /** Seções ATIVAS da tela Catálogo, já na ordem. */
    secoes: LinhaSecao[]
    /** Preços da campanha vigente, por produto. Vazio fora de campanha. */
    precos: Map<string, PrecoCampanha>
    fixos: LinhaFixo[]
    grupos: LinhaGrupo[]
    /** Capa de cada produto (cat_imagens_produto). */
    imagens: Map<string, string>
    /** Foto provisória de combo pelo código (usada só sem capa cadastrada). */
    fotoProvisoria: (codigo: string) => string | null
}

export const SECAO_SEM_SECAO = { id: 'mais-produtos', nome: 'Mais produtos' } as const
/** Até quantos produtos uma seção mostra em cartões com foto grande; acima disso, lista. */
export const LIMITE_CARTOES = 4

const ROTULO_SELO: Record<SeloVariant, string> = {
    mais_vendido: 'Mais vendido',
    oferta: 'Oferta',
    queridinho: 'Queridinho',
}

function rotuloSelo(selo: string | null): string | null {
    if (!selo) return null
    return selo in ROTULO_SELO ? ROTULO_SELO[selo as SeloVariant] : null
}

function linhas(texto: string | null): string[] {
    return (texto ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
}

/** Doce controlado pelo estoque só está à venda com estoque livre. */
function temEstoqueLivre(estoqueAtual: number | null): boolean {
    return (estoqueAtual ?? 0) > 0
}

/** Aparece na loja: "Visível no catálogo", ou combo com preço na campanha vigente. */
export function apareceNaLoja(
    p: Pick<LinhaProduto, 'id' | 'eh_combo' | 'visivel_catalogo'>,
    precos: Map<string, PrecoCampanha>,
): boolean {
    return p.visivel_catalogo || (p.eh_combo && precos.has(p.id))
}

export function montarVitrine(d: DadosVitrine): Vitrine {
    const produtos = new Map(d.produtos.map((p) => [p.id, p]))
    const complemento = new Map(d.vitrine.map((v) => [v.produto_id, v]))
    const nomeNaLoja = (id: string, nome: string) => complemento.get(id)?.nome_loja ?? nome

    // Esgotado: só pela loja_vitrine (chave manual, ou estoque quando ela manda controlar).
    const disponivel = (id: string): boolean => {
        const p = produtos.get(id)
        if (!p) return false
        const v = complemento.get(id)
        if (!v) return true
        return v.disponivel && (!v.usa_estoque || temEstoqueLivre(p.estoque_atual))
    }

    const ehDaCampanha = (p: LinhaProduto) => p.eh_combo && d.precos.has(p.id)
    const visiveis = d.produtos.filter((p) => apareceNaLoja(p, d.precos))

    const ordem = (p: LinhaProduto) => complemento.get(p.id)?.ordem_loja ?? p.ordem_vitrine
    const porOrdem = (a: LinhaProduto, b: LinhaProduto) =>
        ordem(a) - ordem(b) || a.nome.localeCompare(b.nome, 'pt-BR')

    const produtoDa = (p: LinhaProduto): ProdutoLoja => {
        const preco = d.precos.get(p.id)
        const ancoragem = p.preco_ancoragem !== null && p.preco_ancoragem > p.preco ? p.preco_ancoragem : null
        return {
            id: p.id,
            slug: p.slug,
            nome: nomeNaLoja(p.id, p.nome),
            subtitulo: p.subtitulo,
            chamada: complemento.get(p.id)?.frase_card ?? null,
            descricao: p.descricao,
            // Capa cadastrada no sistema primeiro; sem ela, a composição provisória do combo (se houver).
            imagemUrl: d.imagens.get(p.id) ?? d.fotoProvisoria(p.codigo),
            selo: rotuloSelo(p.selo),
            beneficios: linhas(p.beneficios),
            preparo: linhas(p.instrucoes_preparo),
            preco: preco ? preco.pix : p.preco,
            precoDe: preco ? (p.preco > preco.pix ? p.preco : null) : ancoragem,
            precoCredito: preco ? preco.credito : null,
            disponivel: disponivel(p.id),
        }
    }

    const fixosPorCombo = new Map<string, ItemFixo[]>()
    for (const f of d.fixos) {
        const lista = fixosPorCombo.get(f.combo_id) ?? []
        lista.push({
            produtoId: f.componente.id,
            nome: nomeNaLoja(f.componente.id, f.componente.nome),
            quantidade: f.quantidade,
            brinde: f.brinde,
        })
        fixosPorCombo.set(f.combo_id, lista)
    }

    const gruposPorCombo = new Map<string, GrupoCombo[]>()
    for (const g of d.grupos) {
        const lista = gruposPorCombo.get(g.combo_id) ?? []
        lista.push({
            id: g.id,
            titulo: g.titulo,
            rotuloSingular: g.rotulo_singular,
            rotuloPlural: g.rotulo_plural,
            quantidade: g.quantidade,
            permiteRepetir: g.permite_repetir,
            opcoes: [...g.opcoes]
                .sort((a, b) => a.ordem - b.ordem)
                .map((o) => ({
                    produtoId: o.produto_id,
                    nome: nomeNaLoja(o.produto_id, o.produto.nome),
                    imagemUrl: d.imagens.get(o.produto_id) ?? null,
                    disponivel: disponivel(o.produto_id),
                })),
        })
        gruposPorCombo.set(g.combo_id, lista)
    }

    const comboDa = (p: LinhaProduto): ComboLoja => {
        const base = produtoDa(p)
        const preco = d.precos.get(p.id)
        const grupos = gruposPorCombo.get(p.id) ?? []
        const fixos = fixosPorCombo.get(p.id) ?? []
        // Combo só de itens fixos (ex.: Dupla Zero) vai direto para a sacola.
        // Com grupos, cada grupo precisa de sabores livres suficientes; grupo sem sabores = "em definição".
        const montavel =
            grupos.length === 0
                ? fixos.length > 0
                : grupos.every((g) => {
                      const livres = g.opcoes.filter((o) => o.disponivel).length
                      return g.permiteRepetir ? livres >= 1 : livres >= g.quantidade
                  })
        return {
            ...base,
            precoDe: null,
            disponivel: base.disponivel && fixos.every((f) => disponivel(f.produtoId)),
            resumo: complemento.get(p.id)?.resumo ?? null,
            ancora: preco ? preco.ancora : base.precoDe,
            fixos,
            grupos,
            montavel,
        }
    }

    const itemDa = (p: LinhaProduto): ProdutoLoja => (p.eh_combo ? comboDa(p) : produtoDa(p))

    // Combos da campanha: bloco próprio no topo, com o destaque (hero).
    const combos = visiveis.filter(ehDaCampanha).sort(porOrdem).map(comboDa)
    const hero = combos.find((c) => complemento.get(c.id)?.destaque_hero) ?? null

    // Demais produtos (e combos permanentes) nas seções da tela Catálogo.
    const ativas = new Set(d.secoes.map((s) => s.id))
    const porSecao = new Map<string, LinhaProduto[]>()
    for (const p of visiveis) {
        if (ehDaCampanha(p)) continue
        const escolhida = complemento.get(p.id)?.secao_id ?? p.secao_id
        const chave = escolhida && ativas.has(escolhida) ? escolhida : SECAO_SEM_SECAO.id
        porSecao.set(chave, [...(porSecao.get(chave) ?? []), p])
    }
    const secao = (id: string, nome: string, ancora: string): SecaoLoja[] => {
        const doGrupo = (porSecao.get(id) ?? []).sort(porOrdem)
        if (doGrupo.length === 0) return []
        return [
            {
                id: ancora,
                nome,
                // Combos da seção sempre vão em cartão próprio; o formato vale para os avulsos.
                formato: doGrupo.filter((p) => !p.eh_combo).length <= LIMITE_CARTOES ? 'cartoes' : 'lista',
                itens: doGrupo.map(itemDa),
            },
        ]
    }
    const secoes = [
        ...d.secoes.flatMap((s) => secao(s.id, s.nome, `secao-${s.slug}`)),
        ...secao(SECAO_SEM_SECAO.id, SECAO_SEM_SECAO.nome, SECAO_SEM_SECAO.id),
    ]

    const levaJuntoLinha = visiveis.find((p) => !p.eh_combo && complemento.get(p.id)?.leva_junto)

    return {
        campanha: d.campanha,
        hero,
        combos,
        secoes,
        levaJunto: levaJuntoLinha ? produtoDa(levaJuntoLinha) : null,
    }
}
