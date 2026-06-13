import type { FreteConfig } from './types'

const RAIO_TERRA_KM = 6371
const rad = (deg: number) => (deg * Math.PI) / 180

/** Distância em km entre dois pontos (haversine). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dLat = rad(b.lat - a.lat)
    const dLng = rad(b.lng - a.lng)
    const lat1 = rad(a.lat)
    const lat2 = rad(b.lat)
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * RAIO_TERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Frete pela distância, conforme o modo da config. Retorna null quando a distância
 * passa da última faixa (→ "a combinar").
 * - progressivo: cada trecho de km é cobrado pela taxa da sua faixa (tipo faixa de imposto).
 * - taxa_faixa: distância total × taxa da faixa em que ela cai.
 */
export function calcularFretePorDistancia(distanciaKm: number, config: FreteConfig): number | null {
    const faixas = [...config.faixas].sort((a, b) => a.ateKm - b.ateKm)
    if (faixas.length === 0) return null

    if (config.modo === 'taxa_faixa') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        if (!faixa) return null
        return Math.round(distanciaKm * faixa.valorPorKm * 100) / 100
    }

    // progressivo (default)
    let anterior = 0
    let total = 0
    for (const faixa of faixas) {
        const trecho = Math.min(distanciaKm, faixa.ateKm) - anterior
        if (trecho > 0) total += trecho * faixa.valorPorKm
        anterior = faixa.ateKm
        if (distanciaKm <= faixa.ateKm) return Math.round(total * 100) / 100
    }
    return null // além da última faixa
}
