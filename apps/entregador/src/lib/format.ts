export const moeda = (v: number | null | undefined): string =>
    (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo — pra comparar com vendas.data. */
export const hojeSP = (): string =>
    new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 10)

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (sem depender de Date/fuso). */
export const dataBR = (d: string | null | undefined): string => {
    if (!d) return ''
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
}
