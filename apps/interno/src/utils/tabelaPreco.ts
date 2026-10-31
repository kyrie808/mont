/**
 * Tabela de preço da venda (Black da Mont, 30/10/2026).
 *
 * Na campanha o preço depende de como o cliente paga: Pix/dinheiro leva o preço Black,
 * cartão leva a tabela de cartão, fiado (e brinde) fica no preço normal. Fora da campanha as
 * três tabelas têm o mesmo número (`produtos.preco`), então nada muda para quem vende.
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
 * A tabela que vale para a venda.
 *
 * - Fiado e brinde: sempre normal (fiado só no preço cheio; brinde não é cobrado).
 * - Forma de pagamento já escolhida (pagar agora ou na entrega): ela manda.
 * - "Receber depois" sem forma: vale a escolhida no carrinho.
 */
export function tabelaDaVenda(
    intencao: Extract<PagamentoMetodo, 'venda' | 'fiado' | 'brinde'>,
    metodo: 'pix' | 'dinheiro' | 'cartao' | null,
    escolhida: TabelaPreco,
): TabelaPreco {
    if (intencao === 'fiado' || intencao === 'brinde') return 'normal'
    if (metodo === 'pix' || metodo === 'dinheiro') return 'pix'
    if (metodo === 'cartao') return 'cartao'
    return escolhida
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
