// Modelo da vitrine que o servidor monta e entrega às telas.
// Valores em reais. Nada de custo nem de estoque bruto vai para o navegador.

export interface ProdutoLoja {
    id: string
    slug: string
    nome: string
    /** Subtítulo do cadastro: a frase curta sob o nome no card. NULL = sem frase. */
    subtitulo: string | null
    descricao: string | null
    /** Capa: a foto do card e da prévia do link. */
    imagemUrl: string | null
    /** Galeria do cadastro, capa primeiro (página e painel do produto). Sem foto: vazia. */
    fotos: string[]
    /** Categoria do cadastro (congelado, refrigerado…): complemento do "Leve junto". */
    categoria: string | null
    /** Selo do cadastro já em texto ("Mais vendido", "Oferta", "Queridinho"). NULL = sem selo. */
    selo: string | null
    /** Benefícios do cadastro, um por linha. */
    beneficios: string[]
    /** Modo de preparo do cadastro, um passo por linha. */
    preparo: string[]
    /** Preço que vale agora: Pix da campanha, ou produtos.preco fora dela. */
    preco: number
    /** Preço riscado ("de"): só durante a campanha, e é o preço normal do cadastro. Fora dela, NULL. */
    precoDe: number | null
    /** Crédito 1x da tabela aprovada. Só durante a campanha. */
    precoCredito: number | null
    disponivel: boolean
}

export interface ItemFixo {
    produtoId: string
    nome: string
    quantidade: number
    /** Dado de brinde no combo (produto_componentes.brinde): só muda o texto do "Já incluso". */
    brinde: boolean
}

export interface OpcaoGrupo {
    produtoId: string
    nome: string
    imagemUrl: string | null
    disponivel: boolean
}

export interface GrupoCombo {
    id: string
    titulo: string
    rotuloSingular: string
    rotuloPlural: string
    quantidade: number
    permiteRepetir: boolean
    opcoes: OpcaoGrupo[]
}

export interface ComboLoja extends ProdutoLoja {
    /** Texto montado dos itens (fixos, grupos de escolha e brinde). */
    resumo: string | null
    /** "Separado": soma dos itens no preço vigente (cada grupo pelo sabor mais barato). NULL = não exibir. */
    ancora: number | null
    fixos: ItemFixo[]
    grupos: GrupoCombo[]
    /** Tem grupos de escolha e opções suficientes para fechar o combo. */
    montavel: boolean
}

export function ehCombo(p: ProdutoLoja): p is ComboLoja {
    return 'grupos' in p
}

/** Seção com poucos produtos vira cartões com foto grande; com muitos, lista. */
export type FormatoSecao = 'cartoes' | 'lista'

/** Uma aba da loja = uma seção da tela Catálogo do sistema interno. */
export interface SecaoLoja {
    /** Âncora na página (#id). */
    id: string
    nome: string
    /** Frase sob o título (cat_secoes.descricao, editável na tela Catálogo). */
    descricao: string | null
    formato: FormatoSecao
    itens: ProdutoLoja[]
}

export interface Campanha {
    nome: string
    fim: string
}

export interface Vitrine {
    campanha: Campanha | null
    hero: ComboLoja | null
    /** Combos da campanha vigente (bloco próprio, no topo). */
    combos: ComboLoja[]
    secoes: SecaoLoja[]
}
