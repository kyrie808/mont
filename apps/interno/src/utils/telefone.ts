import { cleanPhone } from '@mont/shared'

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
 */
export function filtroBuscaContato(termo: string): string {
    const bruto = sanitizarTermo(termo)
    const exato = /\s$/.test(bruto) && bruto.trim() !== ''
    const safe = bruto.trim()
    if (!safe) return ''

    const digitos = safe.replace(/\D/g, '')
    const partes: string[] = []

    if (exato) {
        // `\y` = âncora de palavra do Postgres; `imatch` = operador `~*`.
        const rx = `\\y${escaparRegex(safe)}\\y`
        partes.push(`nome.imatch.${rx}`, `apelido.imatch.${rx}`)
        if (digitos.length >= 3) partes.push(`telefone_norm.eq.${digitos}`)
    } else {
        partes.push(`nome.ilike.%${safe}%`, `apelido.ilike.%${safe}%`)
        if (digitos.length >= 3) partes.push(`telefone_norm.ilike.%${digitos}%`)
    }

    return partes.join(',')
}
