import { z } from 'zod'

// Frete por distância de ROTA (o mesmo cálculo do catálogo antigo, decisão D1 da paridade).
// A config vive em configuracoes.chave = 'frete_config' (aba Frete do sistema interno).

export const esquemaFreteConfig = z.object({
    modo: z.enum(['progressivo', 'taxa_faixa', 'valor_fixo']),
    origem: z.object({ lat: z.number(), lng: z.number() }),
    faixas: z.array(
        z.object({
            ateKm: z.number().positive(),
            valorPorKm: z.number().optional(),
            valorFixo: z.number().optional(),
        }),
    ),
})

export type FreteConfig = z.infer<typeof esquemaFreteConfig>

/** `frete` em reais quando calculado; `null` = "a combinar" (fora do alcance, sem rota, sem config). */
export interface FreteEstimado {
    frete: number | null
}

/**
 * Frete pela distância, conforme o modo da config. `null` quando a distância passa da última
 * faixa ou o valor da faixa é inválido (→ "a combinar"). Nunca devolve R$ 0.
 * - valor_fixo: valor fechado da faixa em que a distância cai;
 * - progressivo: cada trecho de km pela taxa da sua faixa;
 * - taxa_faixa: distância total × taxa da faixa em que ela cai.
 */
export function fretePorDistancia(distanciaKm: number, config: FreteConfig): number | null {
    const faixas = [...config.faixas].sort((a, b) => a.ateKm - b.ateKm)
    if (faixas.length === 0 || !Number.isFinite(distanciaKm) || distanciaKm < 0) return null

    const valido = (v: number | undefined): number | null =>
        v !== undefined && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null

    if (config.modo === 'valor_fixo') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        return faixa ? valido(faixa.valorFixo) : null
    }

    if (config.modo === 'taxa_faixa') {
        const faixa = faixas.find((f) => distanciaKm <= f.ateKm)
        return faixa?.valorPorKm !== undefined ? valido(distanciaKm * faixa.valorPorKm) : null
    }

    let anterior = 0
    let total = 0
    for (const faixa of faixas) {
        const trecho = Math.min(distanciaKm, faixa.ateKm) - anterior
        if (trecho > 0) {
            if (faixa.valorPorKm === undefined) return null
            total += trecho * faixa.valorPorKm
        }
        anterior = faixa.ateKm
        if (distanciaKm <= faixa.ateKm) return valido(total)
    }
    return null
}
