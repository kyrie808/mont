import type { FreteConfig } from './types'

/**
 * Frete pela distância, conforme o modo da config. Retorna null quando a distância
 * passa da última faixa ou o valor da faixa é inválido (→ "a combinar").
 * - valor_fixo: valor fechado da faixa em que a distância cai (não por km).
 * - progressivo: cada trecho de km é cobrado pela taxa da sua faixa (tipo faixa de imposto).
 * - taxa_faixa: distância total × taxa da faixa em que ela cai.
 */
export function calcularFretePorDistancia(distanciaKm: number, config: FreteConfig): number | null {
    const faixas = [...config.faixas].sort((a, b) => a.ateKm - b.ateKm)
    if (faixas.length === 0) return null

    // Só vale um frete POSITIVO. Valor ausente/0/NaN (config inconsistente, ex.: modo
    // trocado sem preencher os valores) → null = "a combinar". Nunca R$ 0 cobrável.
    const valido = (v: number | undefined): number | null =>
        Number.isFinite(v) && (v as number) > 0 ? Math.round((v as number) * 100) / 100 : null

    if (config.modo === 'valor_fixo') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        return faixa ? valido(faixa.valorFixo) : null
    }

    if (config.modo === 'taxa_faixa') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        if (!faixa || !Number.isFinite(faixa.valorPorKm)) return null
        return valido(distanciaKm * (faixa.valorPorKm as number))
    }

    // progressivo (default)
    let anterior = 0
    let total = 0
    for (const faixa of faixas) {
        const trecho = Math.min(distanciaKm, faixa.ateKm) - anterior
        if (trecho > 0) {
            if (!Number.isFinite(faixa.valorPorKm)) return null // faixa sem taxa → a combinar
            total += trecho * (faixa.valorPorKm as number)
        }
        anterior = faixa.ateKm
        if (distanciaKm <= faixa.ateKm) return valido(total)
    }
    return null // além da última faixa
}
