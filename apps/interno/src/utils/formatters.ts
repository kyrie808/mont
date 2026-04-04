
/**
 * Formatar telefone para exibição
 * Input: 11999999999 -> Output: (11) 99999-9999
 */
export function formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }

    return phone
}

/**
 * Limpar telefone para armazenamento (apenas números)
 */
export function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '')
}

/**
 * Validar formato de telefone brasileiro
 */
export function isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '')
    return cleaned.length === 10 || cleaned.length === 11
}

/**
 * Formatar data para exibição
 * Força timezone America/Sao_Paulo
 */
/**
 * Formatar data para exibição
 * Força timezone America/Sao_Paulo
 */
export function formatDate(date: string | Date): string {
    let d = date
    if (typeof date === 'string') {
        // Se for string de data simples (YYYY-MM-DD), garantir interpretação correta
        if (date.length === 10 && date.includes('-')) {
            // Adiciona T12:00:00 para garantir que fique no dia correto independentemente do offset
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
 * Compara apenas a data (sem hora) para evitar problemas de timezone
 */
export function formatRelativeDate(date: string | Date): string {
    let d: Date

    // Tratamento específico para strings YYYY-MM-DD para evitar shift de timezone (UTC -> Local)
    if (typeof date === 'string' && date.length === 10 && date.includes('-')) {
        // Criar data ao meio-dia para evitar problemas de fronteira de dia
        d = new Date(`${date}T12:00:00`)
    } else {
        d = typeof date === 'string' ? new Date(date) : date
    }

    const now = new Date()

    // Normalizar para comparar apenas a data (ignorar hora)
    // Usar 'America/Sao_Paulo' para o 'now' também seria ideal, mas system time geralmente é o esperado pelo browser
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
 * Pluralizar palavra
 */
export function pluralize(count: number, singular: string, plural: string): string {
    return count === 1 ? singular : plural
}
