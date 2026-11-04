import type { SeloVariant } from '@mont/shared'
import type { ComboLoja, GrupoCombo, ItemFixo, ProdutoLoja, SecaoLoja, Vitrine } from './tipos'

// Monta a vitrine a partir do CADASTRO do sistema interno (função pura; as consultas ficam em carregar.ts).
// Regra (Partes A e B da paridade, 02 e 04/11/2026):
// - aparece o produto ativo com "Visível no catálogo"; combo de campanha aparece durante a campanha;
// - abas = seções ativas da tela Catálogo, na ordem de lá (com a frase da seção); sem seção = "Mais produtos";
// - ordem = a da tela Catálogo (ordem_vitrine), inclusive a dos combos da campanha;
// - nome = "Nome na loja" do cadastro, senão o nome; o card mostra o subtítulo do cadastro;
// - "Esgotado" do cadastro tira da venda e dos sabores dos combos; o estoque não decide nada;
// - banner = combo da campanha com "Destaque" no cadastro, senão o primeiro;
// - texto do combo e "separado" saem dos itens (separado = soma no preço vigente).

export interface LinhaProduto {
    id: string
    codigo: string
    nome: string
    nome_loja: string | null
    slug: string
    subtitulo: string | null
    descricao: string | null
    categoria: string | null
    preco: number
    eh_combo: boolean
    visivel_catalogo: boolean
    esgotado: boolean
    destaque: boolean | null
    secao_id: string | null
    ordem_vitrine: number
    selo: string | null
    beneficios: string | null
    instrucoes_preparo: string | null
}

export interface LinhaSecao {
    id: string
    nome: string
    slug: string
    descricao: string | null
}

export interface PrecoCampanha {
    pix: number
    credito: number
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
    /** Seções ATIVAS da tela Catálogo, já na ordem. */
    secoes: LinhaSecao[]
    /** Preços da campanha vigente, por produto. Vazio fora de campanha. */
    precos: Map<string, PrecoCampanha>
    fixos: LinhaFixo[]
    grupos: LinhaGrupo[]
    /** Fotos de cada produto (cat_imagens_produto), capa primeiro. */
    imagens: Map<string, string[]>
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

const emCentavos = (valor: number) => Math.round(valor * 100)

/** Aparece na loja: "Visível no catálogo", ou combo com preço na campanha vigente. */
export function apareceNaLoja(
    p: Pick<LinhaProduto, 'id' | 'eh_combo' | 'visivel_catalogo'>,
    precos: Map<string, PrecoCampanha>,
): boolean {
    return p.visivel_catalogo || (p.eh_combo && precos.has(p.id))
}

/**
 * Fotos de cada produto (linhas de cat_imagens_produto já na ordem do cadastro): a capa ("cover")
 * vai na frente, mesmo que a ordem diga outra coisa; sem capa, a de menor ordem é a primeira.
 */
export function fotosEmOrdem(linhas: { produto_id: string | null; url: string; tipo: string }[]): Map<string, string[]> {
    const mapa = new Map<string, string[]>()
    const capas = new Map<string, string>()
    for (const img of linhas) {
        if (!img.produto_id) continue
        const fotos = mapa.get(img.produto_id) ?? []
        if (!fotos.includes(img.url)) fotos.push(img.url)
        mapa.set(img.produto_id, fotos)
        if (img.tipo === 'cover' && !capas.has(img.produto_id)) capas.set(img.produto_id, img.url)
    }
    for (const [id, capa] of capas) {
        mapa.set(id, [capa, ...(mapa.get(id) ?? []).filter((url) => url !== capa)])
    }
    return mapa
}

/** "Balde 4 kg + 2× Baldinho 1 kg + 6 doces à escolha + Doce de leite 400 g de brinde". */
export function resumoDoCombo(fixos: ItemFixo[], grupos: GrupoCombo[]): string | null {
    const item = (f: ItemFixo) => (f.quantidade > 1 ? `${f.quantidade}× ${f.nome}` : f.nome)
    const partes = [
        ...fixos.filter((f) => !f.brinde).map(item),
        ...grupos.map((g) => `${g.quantidade} ${g.quantidade === 1 ? g.rotuloSingular : g.rotuloPlural} à escolha`),
        ...fixos.filter((f) => f.brinde).map((f) => `${item(f)} de brinde`),
    ]
    return partes.length > 0 ? partes.join(' + ') : null
}

export function montarVitrine(d: DadosVitrine): Vitrine {
    const produtos = new Map(d.produtos.map((p) => [p.id, p]))
    const nomeNaLoja = (id: string, nome: string) => produtos.get(id)?.nome_loja ?? nome
    const disponivel = (id: string): boolean => {
        const p = produtos.get(id)
        return p !== undefined && !p.esgotado
    }
    // Preço que vale agora para um item: o Pix da campanha, se ele tiver; senão, o do cadastro.
    const vigente = (id: string): number | null => d.precos.get(id)?.pix ?? produtos.get(id)?.preco ?? null

    const ehDaCampanha = (p: LinhaProduto) => p.eh_combo && d.precos.has(p.id)
    const visiveis = d.produtos.filter((p) => apareceNaLoja(p, d.precos))

    const porOrdem = (a: LinhaProduto, b: LinhaProduto) =>
        a.ordem_vitrine - b.ordem_vitrine || a.nome.localeCompare(b.nome, 'pt-BR')

    const produtoDa = (p: LinhaProduto): ProdutoLoja => {
        const preco = d.precos.get(p.id)
        // Fotos cadastradas no sistema primeiro; sem nenhuma, a composição provisória do combo (se houver).
        const cadastradas = d.imagens.get(p.id) ?? []
        const provisoria = cadastradas.length === 0 ? d.fotoProvisoria(p.codigo) : null
        const fotos = provisoria ? [provisoria] : cadastradas
        return {
            id: p.id,
            slug: p.slug,
            nome: p.nome_loja ?? p.nome,
            subtitulo: p.subtitulo,
            descricao: p.descricao,
            imagemUrl: fotos[0] ?? null,
            fotos,
            categoria: p.categoria,
            selo: rotuloSelo(p.selo),
            beneficios: linhas(p.beneficios),
            preparo: linhas(p.instrucoes_preparo),
            preco: preco ? preco.pix : p.preco,
            // Riscado só na campanha, e só com o preço normal (já praticado). Fora dela, sem "de/por" (decisão de 03/11).
            precoDe: preco && p.preco > preco.pix ? p.preco : null,
            precoCredito: preco ? preco.credito : null,
            disponivel: !p.esgotado,
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
                    imagemUrl: d.imagens.get(o.produto_id)?.[0] ?? null,
                    disponivel: disponivel(o.produto_id),
                })),
        })
        gruposPorCombo.set(g.combo_id, lista)
    }

    // "Separado": soma dos itens no preço vigente (brinde incluso); cada grupo pelo sabor mais barato.
    // Sem preço para algum item (ou grupo sem opções), não exibe.
    const separado = (fixos: ItemFixo[], grupos: GrupoCombo[]): number | null => {
        let centavos = 0
        for (const f of fixos) {
            const preco = vigente(f.produtoId)
            if (preco === null) return null
            centavos += emCentavos(preco) * f.quantidade
        }
        for (const g of grupos) {
            const precos = g.opcoes.map((o) => vigente(o.produtoId)).filter((p): p is number => p !== null)
            if (precos.length === 0) return null
            centavos += emCentavos(Math.min(...precos)) * g.quantidade
        }
        return fixos.length + grupos.length > 0 ? centavos / 100 : null
    }

    const comboDa = (p: LinhaProduto): ComboLoja => {
        const base = produtoDa(p)
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
            resumo: resumoDoCombo(fixos, grupos),
            ancora: separado(fixos, grupos),
            fixos,
            grupos,
            montavel,
        }
    }

    const itemDa = (p: LinhaProduto): ProdutoLoja => (p.eh_combo ? comboDa(p) : produtoDa(p))

    // Combos da campanha: bloco próprio no topo, na ordem da tela Catálogo; o banner é o de "Destaque".
    const daCampanha = visiveis.filter(ehDaCampanha).sort(porOrdem)
    const combos = daCampanha.map(comboDa)
    const destaque = daCampanha.find((p) => p.destaque)
    const hero = (destaque ? combos.find((c) => c.id === destaque.id) : combos[0]) ?? null

    // Demais produtos (e combos permanentes) nas seções da tela Catálogo.
    const ativas = new Set(d.secoes.map((s) => s.id))
    const porSecao = new Map<string, LinhaProduto[]>()
    for (const p of visiveis) {
        if (ehDaCampanha(p)) continue
        const chave = p.secao_id && ativas.has(p.secao_id) ? p.secao_id : SECAO_SEM_SECAO.id
        porSecao.set(chave, [...(porSecao.get(chave) ?? []), p])
    }
    const secao = (id: string, nome: string, ancora: string, descricao: string | null): SecaoLoja[] => {
        const doGrupo = (porSecao.get(id) ?? []).sort(porOrdem)
        if (doGrupo.length === 0) return []
        return [
            {
                id: ancora,
                nome,
                descricao,
                // Combos da seção sempre vão em cartão próprio; o formato vale para os avulsos.
                formato: doGrupo.filter((p) => !p.eh_combo).length <= LIMITE_CARTOES ? 'cartoes' : 'lista',
                itens: doGrupo.map(itemDa),
            },
        ]
    }
    const secoes = [
        ...d.secoes.flatMap((s) => secao(s.id, s.nome, `secao-${s.slug}`, s.descricao)),
        ...secao(SECAO_SEM_SECAO.id, SECAO_SEM_SECAO.nome, SECAO_SEM_SECAO.id, null),
    ]

    return { campanha: d.campanha, hero, combos, secoes }
}
