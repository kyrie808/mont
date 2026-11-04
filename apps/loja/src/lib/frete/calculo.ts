import { z } from 'zod'

// Frete da loja (decisão D1 da paridade + regra final de 04/11/2026):
// 1. cidade do CEP numa região de valor fixo (o ABC) → esse valor, sem olhar a distância;
// 2. fora dela, pela distância de ROTA (faixas); além da última faixa → "a combinar".
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
    /** Ex.: ABC = R$ 5 em qualquer bairro, pela cidade do CEP (ViaCEP). */
    regiaoFixa: z
        .object({ nome: z.string(), valor: z.number().positive(), cidades: z.array(z.string()).min(1) })
        .optional(),
    /** Bairros com valor fixo (bairro + cidade do ViaCEP), depois do ABC e antes da distância. */
    bairrosFixos: z
        .array(z.object({ bairro: z.string().min(1), cidade: z.string().min(1), valor: z.number().positive() }))
        .optional(),
})

export type FreteConfig = z.infer<typeof esquemaFreteConfig>

/** `frete` em reais quando calculado; `null` = "a combinar" (fora do alcance, sem rota, sem config). */
export interface FreteEstimado {
    frete: number | null
}

/** "São Bernardo do Campo" e "sao bernardo do campo" são a mesma cidade. */
export function normalizarCidade(cidade: string): string {
    return cidade
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

/** Valor fixo do bairro (bairro + cidade do ViaCEP), sem acento e sem maiúscula; senão `null`. */
export function valorDoBairro(bairro: string | null | undefined, cidade: string | null | undefined, config: FreteConfig): number | null {
    if (!bairro || !cidade) return null
    const [b, c] = [normalizarCidade(bairro), normalizarCidade(cidade)]
    const achado = (config.bairrosFixos ?? []).find((f) => normalizarCidade(f.bairro) === b && normalizarCidade(f.cidade) === c)
    return achado ? Math.round(achado.valor * 100) / 100 : null
}

/** Valor fixo da região (ABC) quando a cidade do CEP está nela; senão `null` (vale a distância). */
export function valorDaRegiao(cidade: string | null | undefined, config: FreteConfig): number | null {
    const regiao = config.regiaoFixa
    if (!regiao || !cidade) return null
    const alvo = normalizarCidade(cidade)
    return regiao.cidades.some((c) => normalizarCidade(c) === alvo) ? Math.round(regiao.valor * 100) / 100 : null
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
