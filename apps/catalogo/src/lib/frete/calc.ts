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

    if (config.modo === 'valor_fixo') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        return Number.isFinite(faixa?.valorFixo) ? (faixa!.valorFixo as number) : null
    }

    if (config.modo === 'taxa_faixa') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        if (!faixa || !Number.isFinite(faixa.valorPorKm)) return null
        return Math.round(distanciaKm * (faixa.valorPorKm as number) * 100) / 100
    }

    // progressivo (default)
    let anterior = 0
    let total = 0
    for (const faixa of faixas) {
        const trecho = Math.min(distanciaKm, faixa.ateKm) - anterior
        if (trecho > 0) total += trecho * (faixa.valorPorKm ?? 0)
        anterior = faixa.ateKm
        if (distanciaKm <= faixa.ateKm) return Math.round(total * 100) / 100
    }
    return null // além da última faixa
}
