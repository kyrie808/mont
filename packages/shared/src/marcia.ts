/**
 * O que a Márcia LÊ a cada turno, renderizado.
 *
 * Separado de `secretaria.ts` de propósito: lá mora a mecânica de ENTREGA (tempo de
 * digitação, partição da resposta, janela do humano, gaiola); aqui mora a montagem do
 * contexto que entra no prompt. Mesmo motivo de viver em `packages/shared`: é a única
 * pasta que o runtime Deno da Edge Function E o Vitest do interno alcançam.
 *
 * Por que isto é código testado e não template no nó do n8n: as duas regras de que o
 * prompt depende — "cumprimenta pelo horário" e "no primeiro contato diz seu nome" —
 * são instrução sobre dado que precisa CHEGAR. Enquanto o catálogo era devolvido pela
 * Edge Function e descartado pelo nó Code, cinco linhas do prompt falavam de
 * `estoqueAtual` que a agente nunca viu. Dado de contexto sem teste apodrece calado.
 */

const FUSO = 'America/Sao_Paulo'

/**
 * `YYYY-MM-DD` do instante dado, no fuso da Mont. `en-CA` é o locale que já dá ISO.
 *
 * Exportada porque a Edge Function também precisa dela (para decidir "primeiro contato
 * hoje"), e uma segunda cópia desta expressão dentro do `index.ts` seria a terceira-cópia
 * -da-regra que já custou um cliente a este projeto.
 */
export function diaEmSaoPaulo(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
}

/**
 * "domingo, 04/10, 09:12" — no fuso de São Paulo, sempre.
 *
 * O servidor da Edge Function roda em UTC. Sem fuso explícito, às 23:30 de sábado em
 * São Paulo a Márcia daria bom dia de domingo.
 *
 * Montado a partir de `formatToParts`, não de `format()`: `Intl` insere separadores
 * invisíveis (NBSP, narrow NBSP) que variam por runtime e por versão de ICU. Este
 * projeto já foi mordido exatamente assim em `formatCurrency`. Com as partes na mão, os
 * separadores são nossos e o resultado é byte-a-byte previsível no teste.
 */
export function formatarAgora(d: Date): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO,
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(d)

    const p = (tipo: Intl.DateTimeFormatPartTypes): string =>
        partes.find((x) => x.type === tipo)?.value ?? ''

    return `${p('weekday')}, ${p('day')}/${p('month')}, ${p('hour')}:${p('minute')}`
}

export interface HistoricoCompra {
    /** Dias distintos em que este cliente comprou. Brinde não conta. */
    compras: number
    /** Os produtos que ele leva mais vezes, já ordenados. No máximo dois. */
    produtosFrequentes: string[]
    /** `YYYY-MM-DD` da compra mais recente, ou null. */
    ultimaCompraEm: string | null
}

/** Mínimo de compras para o histórico entrar no prompt. Ver `renderizarHistorico`. */
export const MIN_COMPRAS_PARA_HISTORICO = 2

/**
 * Diferença em DIAS DE CALENDÁRIO, não em 24h corridas: "ontem" tem que ser ontem mesmo
 * quando a compra foi às 23h e agora é 1h da manhã.
 */
function diasEntre(dataIso: string, agora: Date): number {
    const compra = Date.UTC(
        Number(dataIso.slice(0, 4)), Number(dataIso.slice(5, 7)) - 1, Number(dataIso.slice(8, 10)),
    )
    const hojeSp = diaEmSaoPaulo(agora)
    const hoje = Date.UTC(
        Number(hojeSp.slice(0, 4)), Number(hojeSp.slice(5, 7)) - 1, Number(hojeSp.slice(8, 10)),
    )
    return Math.round((hoje - compra) / 86_400_000)
}

/**
 * O histórico de compra em duas linhas, ou `null` quando não vale dizer nada.
 *
 * É o que separa vendedora experiente de atendente: ela sugere com fundamento ("vai o
 * palito junto, como sempre?") em vez de oferecer no escuro.
 *
 * Entra a partir da SEGUNDA compra. Com uma compra só não existe padrão de consumo —
 * dizer "costuma levar" para quem comprou uma vez soa invasivo e não ajuda a sugerir.
 */
export function renderizarHistorico(h: HistoricoCompra | null, agora: Date): string | null {
    if (!h || h.compras < MIN_COMPRAS_PARA_HISTORICO) return null

    const linhas: string[] = []

    const frequentes = h.produtosFrequentes.length > 0
        ? ` Costuma levar: ${h.produtosFrequentes.join(', ')}.`
        : ''
    linhas.push(`Já comprou ${h.compras} vezes.${frequentes}`)

    if (h.ultimaCompraEm) {
        const dias = diasEntre(h.ultimaCompraEm, agora)
        const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `${dias} dias atrás`
        linhas.push(`Última compra: ${quando}.`)
    }

    return linhas.join('\n')
}

/**
 * A mensagem que a Márcia manda para o cliente que montou pedido e parou de responder.
 *
 * Template, não segunda chamada de modelo. O W4 é um cron que roda a cada 10 minutos
 * numa VPS que já derrubou 19 execuções por pressão de memória; pendurar uma chamada de
 * LLM nesse caminho adiciona modo de falha a uma rota que precisa ser confiável, e o
 * ganho seria uma frase. O pedido vem renderizado do BANCO — ela nunca escreve o pedido
 * de cabeça, nem aqui.
 */
export function montarRetomada(pedidoCliente: string): string {
    return `Oi! Ficou aqui o seu pedido: ${pedidoCliente}. Quer que eu feche? 😊`
}
