const inteiro = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})
const comCentavos = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

/** Reais como na loja: "R$ 65" quando inteiro, "R$ 65,90" quando há centavos. */
export function reais(valor: number): string {
    const centavos = Math.round(valor * 100)
    return centavos % 100 === 0 ? inteiro.format(centavos / 100) : comCentavos.format(centavos / 100)
}

const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/** "30/11" no fuso de São Paulo. */
export function diaMesSP(iso: string): string {
    return diaMes.format(new Date(iso))
}

export function linkWhatsApp(numero: string, texto?: string): string {
    return texto ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : `https://wa.me/${numero}`
}
