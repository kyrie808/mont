import { cleanPhone, stripAccents } from '@mont/shared'

/**
 * Reduz o telefone ao seu identificador: só dígitos.
 *
 * É o mesmo formato da coluna gerada `contatos.telefone_norm`, que carrega o
 * índice único — ou seja, esta função e o banco enxergam a mesma identidade.
 */
export function normalizarTelefone(raw: string | null | undefined): string {
    if (!raw) return ''
    return cleanPhone(raw)
}

/** Mensagem única de telefone fora do padrão — igual em todo canto que valida. */
export const TELEFONE_INVALIDO_MSG =
    'O WhatsApp precisa ter 11 dígitos com o DDD (ex.: 11 95552-2314). Confira se não faltou o 9.'

/**
 * `true` quando o telefone está no padrão de celular brasileiro: DDD + 9 dígitos.
 *
 * **Por que 11 exatos, e não "10 ou 11".** Em 08/08/2026 um cliente foi
 * cadastrado duas vezes: "Vilma Margarete" com `11955522314` e "Vilma" com
 * `1155522314` — o mesmo número sem o 9. O índice único de `telefone_norm`
 * compara strings de dígitos, então 10 ≠ 11 e as duas passaram.
 *
 * Não dá pra consertar inserindo o 9 sozinho: a parte local `5552-2314` começa
 * com 5, exatamente o formato de um fixo de São Paulo. Um palpite do tipo "põe o
 * 9 quando parecer celular" erraria este caso, e "põe o 9 em todo número de 10
 * dígitos" corromperia os fixos de verdade. Como 96,5% da base é celular e o
 * contato serve pra falar no WhatsApp, exigir o formato é mais honesto que
 * adivinhar — o operador corrige na hora, com o cliente na frente.
 */
export function isCelularValido(raw: string | null | undefined): boolean {
    return normalizarTelefone(raw).length === 11
}

/**
 * Remove o que quebraria o `.or()` do PostgREST (curingas e separadores).
 * NÃO apara as pontas: o espaço no fim é sinal do usuário, não ruído.
 */
function sanitizarTermo(termo: string): string {
    return termo.replace(/[%_,()"]/g, '')
}

/** Neutraliza metacaracteres POSIX para que o termo seja casado como literal. */
function escaparRegex(termo: string): string {
    return termo.replace(/[\\^$.|?*+[\]{}]/g, '\\$&')
}

/**
 * `true` quando o termo termina em espaço e tem conteúdo — ou seja, quando a
 * busca está no modo palavra exata.
 *
 * Mora aqui junto do filtro de propósito: é a mesma regra que a barra de busca
 * usa para acender o chip "palavra exata". Se UI e filtro discordassem, o chip
 * mentiria sobre o que está sendo consultado.
 */
export function isBuscaExata(termo: string): boolean {
    return /\s$/.test(termo) && termo.trim() !== ''
}

/**
 * Monta o filtro `.or()` de busca de contato por nome, apelido ou telefone.
 *
 * Telefone casa sempre contra `telefone_norm` (dígitos), nunca contra o texto
 * cru: `(11) 96979-1012`, `11 96979-1012` e `11969791012` acham o mesmo
 * cliente, independente de como foi salvo ou digitado.
 *
 * **Espaço no fim = palavra exata.** Digitar o espaço significa "acabou a
 * palavra, quero ESSA palavra": `'Clau'` traz Claudete/Claudia/Claudiana,
 * `'Clau '` traz só quem tem "Clau" como palavra inteira. No telefone a mesma
 * ideia vira número completo e idêntico em vez de pedaço do número.
 *
 * **Acento é irrelevante.** Nome e apelido casam contra as colunas geradas
 * `nome_norm`/`apelido_norm`, que o banco preenche com `normalize(…, NFD)` sem
 * as marcas de acento. Aqui o termo passa pelo `stripAccents`, que faz
 * exatamente a mesma coisa — os dois lados precisam concordar, senão a busca
 * falharia em silêncio. Assim `'Claudia'` acha "Cláudia" e vice-versa.
 */
export function filtroBuscaContato(termo: string): string {
    const bruto = sanitizarTermo(termo)
    const exato = isBuscaExata(bruto)
    const safe = stripAccents(bruto.trim())
    if (!safe) return ''

    const digitos = safe.replace(/\D/g, '')
    const partes: string[] = []

    if (exato) {
        // `\y` = âncora de palavra do Postgres; `imatch` = operador `~*`.
        const rx = `\\y${escaparRegex(safe)}\\y`
        partes.push(`nome_norm.imatch.${rx}`, `apelido_norm.imatch.${rx}`)
        if (digitos.length >= 3) partes.push(`telefone_norm.eq.${digitos}`)
    } else {
        partes.push(`nome_norm.ilike.%${safe}%`, `apelido_norm.ilike.%${safe}%`)
        if (digitos.length >= 3) partes.push(`telefone_norm.ilike.%${digitos}%`)
    }

    return partes.join(',')
}
