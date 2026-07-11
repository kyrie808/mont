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

/** 'YYYY-MM-DD' → Date LOCAL (evita o shift de UTC de new Date('2026-07-06')). */
export const parseYMD = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}

/** Date → 'YYYY-MM-DD' pelos componentes LOCAIS (casa com vendas.data). */
export const toYMD = (d: Date): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}
