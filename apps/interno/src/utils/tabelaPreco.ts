/**
 * Tabela de preço da venda (Black da Mont, 30/10/2026).
 *
 * Na campanha o preço depende de como o cliente paga: Pix/dinheiro leva o preço Black,
 * cartão leva a tabela de cartão, fiado (e brinde) fica no preço normal. Fora da campanha as
 * três tabelas têm o mesmo número (`produtos.preco`), então nada muda para quem vende.
 *
 * Regra do Gilmar (04/11/2026): a Black só vale com a forma definida (Pix, dinheiro ou cartão).
 * Fiado e venda sem forma de pagamento saem no preço normal, sem exceção; combo no normal custa a
 * soma dos itens no preço do cadastro (ver `precoComboNormal`).
 *
 * Quem decide o valor gravado é o servidor (`criar_venda` com `p_tabela`, que usa
 * `preco_tabela` e, nos combos, `combo_itens`). Aqui fica só o que a tela precisa para
 * mostrar o mesmo número antes de gravar — os preços vêm de `precos_vigentes`, a mesma regra.
 */
import type { PagamentoMetodo } from '../types/domain'

export type TabelaPreco = 'pix' | 'cartao' | 'normal'

export interface PrecosDoProduto {
    normal: number
    pix: number
    cartao: number
}

export type MapaPrecos = Map<string, PrecosDoProduto>

export const ROTULO_TABELA: Record<TabelaPreco, string> = {
    pix: 'Pix/dinheiro',
    cartao: 'Cartão',
    normal: 'Normal',
}

/** Preço do produto na tabela. Sem o produto no mapa (ainda carregando), vale o do cadastro. */
export function precoNaTabela(mapa: MapaPrecos, produtoId: string, precoCadastro: number, tabela: TabelaPreco): number {
    const precos = mapa.get(produtoId)
    return precos ? precos[tabela] : precoCadastro
}

/**
 * A tabela que vale para a venda (o servidor exige a mesma).
 *
 * - Fiado e brinde: sempre normal (fiado só no preço cheio; brinde não é cobrado).
 * - Forma de pagamento escolhida (Pix, dinheiro, cartão): ela manda.
 * - Sem forma ("receber depois"): normal. A Black exige escolher Pix, dinheiro ou cartão.
 */
export function tabelaDaVenda(
    intencao: Extract<PagamentoMetodo, 'venda' | 'fiado' | 'brinde'>,
    metodo: 'pix' | 'dinheiro' | 'cartao' | null,
): TabelaPreco {
    if (intencao === 'fiado' || intencao === 'brinde') return 'normal'
    if (metodo === 'pix' || metodo === 'dinheiro') return 'pix'
    if (metodo === 'cartao') return 'cartao'
    return 'normal'
}

/** Por que a tabela está travada no checkout (o seletor mostra o motivo). */
export function motivoDaTabela(
    intencao: Extract<PagamentoMetodo, 'venda' | 'fiado' | 'brinde'>,
    metodo: 'pix' | 'dinheiro' | 'cartao' | null,
): string {
    if (intencao === 'fiado' || intencao === 'brinde') return 'Fiado e brinde usam o preço normal.'
    if (metodo) {
        const nome = metodo === 'cartao' ? 'cartão' : metodo === 'pix' ? 'Pix' : 'dinheiro'
        return `Recebendo em ${nome}: vale a tabela ${ROTULO_TABELA[tabelaDaVenda(intencao, metodo)]}.`
    }
    return 'Sem forma de pagamento: preço normal. Para o preço da Black, escolha Pix, dinheiro ou cartão.'
}

// ── Combo no preço normal (fiado e venda sem forma) ────────────────────────────

/** Fixos e grupos do combo, só o que o preço precisa (ver `ComboMontagem`). */
export interface MontagemParaPreco {
    fixos: { produtoId: string; quantidade: number }[]
    grupos: { quantidade: number; opcoes: string[] }[]
}

/**
 * Combo no preço normal: a soma dos itens, cada um no preço do cadastro — fixos (o brinde
 * incluso: no fiado não há brinde) + sabores escolhidos. A mesma conta do servidor
 * (`combo_itens` com a tabela 'normal').
 */
export function precoComboNormal(
    montagem: MontagemParaPreco,
    escolhas: EscolhaCombo[] | undefined,
    normalDe: (produtoId: string) => number,
): number {
    const centavos = (id: string, q: number) => Math.round(normalDe(id) * 100) * q
    const fixos = montagem.fixos.reduce((s, f) => s + centavos(f.produtoId, f.quantidade), 0)
    const sabores = (escolhas ?? []).reduce((s, e) => s + centavos(e.produtoId, e.quantidade), 0)
    return (fixos + sabores) / 100
}

/** Antes de escolher os sabores: o menor e o maior preço normal possíveis do combo. */
export function faixaComboNormal(
    montagem: MontagemParaPreco,
    normalDe: (produtoId: string) => number,
): { min: number; max: number } {
    const base = precoComboNormal(montagem, [], normalDe)
    let min = base
    let max = base
    for (const g of montagem.grupos) {
        const precos = g.opcoes.map(normalDe)
        if (precos.length === 0) continue
        min += Math.min(...precos) * g.quantidade
        max += Math.max(...precos) * g.quantidade
    }
    return { min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100 }
}

/** "Fiado: R$ 345,00 · no Pix: R$ 199,00" — só quando a Black do Pix é outro número. */
export function notaPrecoCombo(normal: number, pix: number, formatar: (v: number) => string, aPartirDe = false): string | null {
    if (Math.round(normal * 100) === Math.round(pix * 100)) return null
    return `Fiado: ${aPartirDe ? 'a partir de ' : ''}${formatar(normal)} · no Pix: ${formatar(pix)}`
}

export function totalNaTabela(
    mapa: MapaPrecos,
    itens: { produtoId: string; precoCadastro: number; quantidade: number }[],
    tabela: TabelaPreco,
): number {
    const centavos = itens.reduce(
        (soma, i) => soma + Math.round(precoNaTabela(mapa, i.produtoId, i.precoCadastro, tabela) * 100) * i.quantidade,
        0,
    )
    return centavos / 100
}

/**
 * O que a Nova Venda oferece: tira o que o servidor marcou como fora de venda
 * (`precos_vigentes.vendavel = false` — combo da campanha com a campanha pausada ou encerrada,
 * cujo `produtos.preco` é o preço promocional). Sem nada fora de venda, a mesma lista.
 */
export function produtosAVenda<T extends { id: string }>(produtos: T[], foraDeVenda: ReadonlySet<string>): T[] {
    if (foraDeVenda.size === 0) return produtos
    return produtos.filter((p) => !foraDeVenda.has(p.id))
}

// ── Combos com escolha de sabor ───────────────────────────────────────────────

export interface EscolhaCombo {
    grupoId: string
    produtoId: string
    quantidade: number
}

export interface GrupoComboRegra {
    id: string
    titulo: string
    quantidade: number
    permiteRepetir: boolean
}

export function escolhidosNoGrupo(grupoId: string, escolhas: EscolhaCombo[]): number {
    return escolhas.filter((e) => e.grupoId === grupoId).reduce((s, e) => s + e.quantidade, 0)
}

export function faltamNoGrupo(grupo: GrupoComboRegra, escolhas: EscolhaCombo[]): number {
    return Math.max(grupo.quantidade - escolhidosNoGrupo(grupo.id, escolhas), 0)
}

/** Cada grupo com a quantidade exata. Combo sem grupos (fixo) já está completo. */
export function escolhasCompletas(grupos: GrupoComboRegra[], escolhas: EscolhaCombo[]): boolean {
    return grupos.every((g) => escolhidosNoGrupo(g.id, escolhas) === g.quantidade)
}

/** "5× Doce de Leite Tradicional 680g, Doce de Leite com Coco 680g" — para a linha do carrinho. */
export function resumoEscolhas(escolhas: EscolhaCombo[], nomes: Map<string, string>): string {
    return escolhas
        .filter((e) => e.quantidade > 0)
        .map((e) => {
            const nome = nomes.get(e.produtoId) ?? 'Sabor'
            return e.quantidade > 1 ? `${e.quantidade}× ${nome}` : nome
        })
        .join(', ')
}

/**
 * Aviso no Quitar quando a forma de pagamento não bate com a tabela de lançamento.
 *
 * O valor da venda NÃO muda sozinho: ele foi fechado com o cliente e pode já estar no aviso
 * do entregador. Cobrar a diferença (ou não) é decisão de quem vende. Venda antiga, sem
 * tabela, ou lançada no preço normal não avisa.
 */
export function avisoTabelaNoPagamento(
    tabela: TabelaPreco | null,
    metodo: string,
): string | null {
    if (tabela === 'pix' && metodo === 'cartao') {
        return 'Esta venda foi lançada com o preço do Pix. O valor não muda sozinho ao receber no cartão; se for cobrar a diferença, ajuste com o cliente.'
    }
    if (tabela === 'cartao' && (metodo === 'pix' || metodo === 'dinheiro')) {
        return 'Esta venda foi lançada com o preço do cartão. O valor não muda sozinho ao receber no Pix ou em dinheiro.'
    }
    return null
}
