import { formatCurrency } from '@mont/shared'

export const reais = formatCurrency

const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/** "30/11" no fuso de São Paulo. */
export function diaMesSP(iso: string): string {
    return diaMes.format(new Date(iso))
}

export function linkWhatsApp(numero: string, texto?: string): string {
    return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`
}
