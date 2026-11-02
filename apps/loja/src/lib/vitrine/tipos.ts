// Modelo da vitrine que o servidor monta e entrega às telas.
// Valores em reais. Nada de custo nem de estoque bruto vai para o navegador.

export type Secao = 'combos' | 'massa' | 'doces' | 'zero'

export interface ProdutoLoja {
    id: string
    slug: string
    nome: string
    subtitulo: string | null
    descricao: string | null
    imagemUrl: string | null
    secao: Secao
    /** Preço que vale agora: Pix da campanha, ou produtos.preco fora dela. */
    preco: number
    /** Preço normal riscado ("de"). Só durante a campanha. */
    precoDe: number | null
    /** Crédito 1x da tabela aprovada. Só durante a campanha. */
    precoCredito: number | null
    disponivel: boolean
}

export interface ItemFixo {
    produtoId: string
    nome: string
    quantidade: number
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
    resumo: string | null
    /** "separado: a partir de". NULL = não exibir. */
    ancora: number | null
    fixos: ItemFixo[]
    grupos: GrupoCombo[]
    /** Tem grupos de escolha e opções suficientes para fechar o combo. */
    montavel: boolean
}

export interface Campanha {
    nome: string
    fim: string
}

export interface Vitrine {
    campanha: Campanha | null
    hero: ComboLoja | null
    combos: ComboLoja[]
    massa: ProdutoLoja[]
    doces: ProdutoLoja[]
    zero: ProdutoLoja[]
    levaJunto: ProdutoLoja | null
}

export interface BairroFrete {
    id: string
    rotulo: string
    valor: number
}
