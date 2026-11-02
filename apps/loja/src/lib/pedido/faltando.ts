import { esquemaEnvioPedido, type EnvioPedido } from './esquema'

/** Campos da tela 05 na ordem em que aparecem, com o nome que o cliente entende. */
const CAMPOS: readonly (readonly [keyof EnvioPedido, string])[] = [
    ['telefone', 'seu WhatsApp'],
    ['nome', 'seu nome'],
    ['cep', 'CEP'],
    ['numero', 'número'],
    ['logradouro', 'rua'],
    ['bairro', 'bairro'],
    ['cidade', 'cidade'],
    ['uf', 'estado (UF)'],
]

/**
 * O que ainda falta preencher para enviar o pedido, pela MESMA regra do servidor
 * (esquemaEnvioPedido). Chave, armadilha de robô e sacola não são do cliente: ficam de fora.
 */
export function faltaParaEnviar(dados: EnvioPedido): string[] {
    const lido = esquemaEnvioPedido.safeParse(dados)
    if (lido.success) return []
    const comProblema = new Set(lido.error.issues.map((i) => i.path[0]))
    return CAMPOS.filter(([campo]) => comProblema.has(campo)).map(([, rotulo]) => rotulo)
}

/** "Para enviar, falta: seu nome, CEP e número." */
export function frasesDoQueFalta(faltando: string[]): string {
    if (faltando.length === 0) return ''
    const lista =
        faltando.length === 1 ? faltando[0] : `${faltando.slice(0, -1).join(', ')} e ${faltando[faltando.length - 1]}`
    return `Para enviar, falta: ${lista}.`
}
