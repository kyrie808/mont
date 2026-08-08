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
