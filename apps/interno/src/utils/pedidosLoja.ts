/**
 * Pedidos da loja (apps/loja → WhatsApp → confirmação aqui). 02/11/2026.
 *
 * O pedido da loja só vira venda quando o Gilmar confirma, com frete, data de entrega e forma
 * de pagamento (`loja_confirmar_pedido`). Aqui ficam as regras da tela que não dependem do banco.
 */

export const DIAS_NA_LISTA_PRINCIPAL = 3

const FUSO = 'America/Sao_Paulo'

export interface ItemPedidoLoja {
    id: string
    produtoId: string | null
    nome: string
    quantidade: number
    total: number
    comboId: string | null
    comboInstancia: string | null
}

export type LinhaPedidoLoja =
    | { tipo: 'produto'; chave: string; nome: string; quantidade: number; total: number }
    | { tipo: 'combo'; chave: string; comboId: string; total: number; itens: { nome: string; quantidade: number }[] }

/** Avulsos como vieram; as linhas de um mesmo combo (mesma instância) viram uma linha só. */
export function agruparItens(itens: ItemPedidoLoja[]): LinhaPedidoLoja[] {
    const linhas: LinhaPedidoLoja[] = []
    const combos = new Map<string, Extract<LinhaPedidoLoja, { tipo: 'combo' }>>()
    for (const item of itens) {
        if (item.comboId && item.comboInstancia) {
            let combo = combos.get(item.comboInstancia)
            if (!combo) {
                combo = { tipo: 'combo', chave: item.comboInstancia, comboId: item.comboId, total: 0, itens: [] }
                combos.set(item.comboInstancia, combo)
                linhas.push(combo)
            }
            combo.total = Math.round((combo.total + item.total) * 100) / 100
            const mesmo = combo.itens.find((i) => i.nome === item.nome)
            if (mesmo) mesmo.quantidade += item.quantidade
            else combo.itens.push({ nome: item.nome, quantidade: item.quantidade })
        } else {
            linhas.push({ tipo: 'produto', chave: item.id, nome: item.nome, quantidade: item.quantidade, total: item.total })
        }
    }
    return linhas
}

/** Pedido parado há mais de 3 dias sai da lista principal (não some: vai para "mais antigos"). */
export function separarPorIdade<T extends { criadoEm: string }>(pedidos: T[], agora: Date = new Date()): { recentes: T[]; antigos: T[] } {
    const limite = agora.getTime() - DIAS_NA_LISTA_PRINCIPAL * 24 * 60 * 60 * 1000
    const recentes: T[] = []
    const antigos: T[] = []
    for (const p of pedidos) (new Date(p.criadoEm).getTime() >= limite ? recentes : antigos).push(p)
    return { recentes, antigos }
}

/** Data de hoje em São Paulo, `aaaa-mm-dd`. */
export function hojeSP(agora: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

/** `aaaa-mm-dd` + n dias (data pura, sem fuso). */
export function somarDias(data: string, dias: number): string {
    const [a, m, d] = data.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** "02/11, 22:41" no horário de São Paulo. */
export function quandoSP(iso: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(iso))
}

/** "dd/mm" de uma data `aaaa-mm-dd`. */
export function diaMes(data: string): string {
    const [, m, d] = data.split('-')
    return `${d}/${m}`
}

function normalizar(texto: string | null | undefined): string {
    return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * O cadastro do cliente já tem um endereço e ele é outro? Aí a tela pergunta se troca pelo do
 * pedido (a confirmação nunca troca sozinha: só preenche o que está vazio).
 */
export function enderecoDiferente(
    pedido: { logradouro: string | null; numero: string | null },
    cadastro: { logradouro: string | null; numero: string | null } | null,
): boolean {
    if (!cadastro || !normalizar(cadastro.logradouro)) return false
    return normalizar(cadastro.logradouro) !== normalizar(pedido.logradouro) || normalizar(cadastro.numero) !== normalizar(pedido.numero)
}
