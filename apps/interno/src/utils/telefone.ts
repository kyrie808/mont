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

/** Remove o que quebraria o `.or()` do PostgREST (curingas e separadores). */
function sanitizarTermo(termo: string): string {
    return termo.replace(/[%_,()]/g, '').trim()
}

/**
 * Monta o filtro `.or()` de busca de contato por nome, apelido ou telefone.
 *
 * O trecho de telefone casa contra `telefone_norm` (dígitos), nunca contra o
 * texto cru: assim `(11) 96979-1012`, `11 96979-1012` e `11969791012` acham
 * o mesmo cliente, independente de como ele foi salvo ou digitado.
 */
export function filtroBuscaContato(termo: string): string {
    const safe = sanitizarTermo(termo)
    if (!safe) return ''

    const partes = [`nome.ilike.%${safe}%`, `apelido.ilike.%${safe}%`]

    const digitos = safe.replace(/\D/g, '')
    if (digitos.length >= 3) {
        partes.push(`telefone_norm.ilike.%${digitos}%`)
    }

    return partes.join(',')
}
