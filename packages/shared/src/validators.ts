/**
 * Validar formato de telefone brasileiro
 * Aceita 10 dígitos (fixo) ou 11 dígitos (celular)
 */
export function isValidPhone(phone: string, strictMobile = false): boolean {
    const cleaned = phone.replace(/\D/g, '')
    if (strictMobile) {
        return cleaned.length === 11
    }
    return cleaned.length === 10 || cleaned.length === 11
}
