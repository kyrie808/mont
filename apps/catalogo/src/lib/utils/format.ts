/**
 * Formata valor em centavos para moeda brasileira
 */
export function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(cents / 100)
}

/**
 * Formata peso em kg com unidade
 */
export function formatWeight(kg: number): string {
    if (kg == null || isNaN(kg)) return '—'
    return `${kg.toFixed(2).replace('.', ',')}kg`
}

/**
 * Formata telefone com máscara (XX) XXXXX-XXXX
 */
export function formatPhone(value: string): string {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '')

    // Aplica máscara
    if (numbers.length <= 2) {
        return numbers
    } else if (numbers.length <= 7) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    } else if (numbers.length <= 11) {
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
    }

    // Limita a 11 dígitos
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`
}

/**
 * Remove máscara do telefone
 */
export function unformatPhone(value: string): string {
    return value.replace(/\D/g, '')
}

/**
 * Valida se telefone tem 11 dígitos
 */
export function isValidPhone(value: string): boolean {
    const numbers = unformatPhone(value)
    return numbers.length === 11
}
