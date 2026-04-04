/**
 * Formatar valor em moeda brasileira (BRL)
 * Trabalha exclusivamente com numérico em reais (R$)
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value)
}

/**
 * Formatar telefone para exibição
 * Input: 11999999999 -> Output: (11) 99999-9999
 * Suporta entrada parcial para uso em inputs com máscara
 */
export function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.length <= 2) {
        return cleaned
    } else if (cleaned.length <= 7) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`
    } else if (cleaned.length <= 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`
    }

    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`
}

/**
 * Limpar telefone para armazenamento (apenas números)
 */
export function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '')
}

/**
 * Remove máscara do telefone (alias para cleanPhone)
 */
export const unformatPhone = cleanPhone

/**
 * Formatar data para exibição
 * Força timezone America/Sao_Paulo
 */
export function formatDate(date: string | Date): string {
    let d = date
    if (typeof date === 'string') {
        if (date.length === 10 && date.includes('-')) {
            d = new Date(`${date}T12:00:00`)
        } else {
            d = new Date(date)
        }
    }

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo'
    }).format(d as Date)
}

/**
 * Formatar data e hora para exibição
 * Força timezone America/Sao_Paulo
 */
export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo'
    }).format(d)
}

/**
 * Formatar data relativa (ex: "há 3 dias")
 */
export function formatRelativeDate(date: string | Date): string {
    let d: Date

    if (typeof date === 'string' && date.length === 10 && date.includes('-')) {
        d = new Date(`${date}T12:00:00`)
    } else {
        d = typeof date === 'string' ? new Date(date) : date
    }

    const now = new Date()
    const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const diffMs = todayOnly.getTime() - dateOnly.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoje'
    if (diffDays === 1) return 'Ontem'
    if (diffDays < 7) return `Há ${diffDays} dias`
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`
    if (diffDays < 365) return `Há ${Math.floor(diffDays / 30)} meses`
    return `Há ${Math.floor(diffDays / 365)} anos`
}

/**
 * Gerar link do WhatsApp
 */
export function getWhatsAppLink(phone: string, message?: string): string {
    const cleaned = cleanPhone(phone)
    const baseUrl = `https://wa.me/55${cleaned}`

    if (message) {
        return `${baseUrl}?text=${encodeURIComponent(message)}`
    }

    return baseUrl
}

/**
 * Formatar peso em kg com unidade
 */
export function formatWeight(kg: number): string {
    if (kg == null || isNaN(kg)) return '—'
    return `${kg.toFixed(2).replace('.', ',')}kg`
}

/**
 * Pluralizar palavra
 */
export function pluralize(count: number, singular: string, plural: string): string {
    return count === 1 ? singular : plural
}
