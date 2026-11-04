import { z } from 'zod'
import { criarClienteServico } from '@/lib/supabase/servico'
import { esquemaFreteConfig, fretePorDistancia, type FreteEstimado } from './calculo'

// Só no servidor (server actions da loja): usa a chave de serviço e a ORS_API_KEY.
// CEP → coordenada → distância de ROTA (OpenRouteService) → faixa de frete. Mesma estratégia do
// catálogo antigo: ViaCEP + Nominatim (sem chave), e NUNCA linha reta nem centroide de bairro
// (subcobraria ou cobraria a faixa errada). Qualquer falha vira "a combinar".

type Coordenada = { lat: number; lng: number }

const DIA = 60 * 60 * 24 // CEP → coordenada e rota são estáveis: cache de 24 h.
const IDENTIFICACAO = 'MontDistribuidora/1.0 (+https://www.montdistribuidora.com.br)'
const A_COMBINAR: FreteEstimado = { frete: null }

const esquemaViaCep = z.object({
    logradouro: z.string().optional(),
    bairro: z.string().optional(),
    localidade: z.string().optional(),
    uf: z.string().optional(),
    erro: z.union([z.boolean(), z.string()]).optional(),
})
const esquemaNominatim = z.array(z.object({ lat: z.coerce.number(), lon: z.coerce.number() }))
const esquemaRota = z.object({
    features: z.array(z.object({ properties: z.object({ summary: z.object({ distance: z.number() }) }) })).min(1),
})

async function lerJson(url: string, cabecalhos?: Record<string, string>): Promise<unknown> {
    try {
        const resposta = await fetch(url, { headers: cabecalhos, next: { revalidate: DIA }, signal: AbortSignal.timeout(6000) })
        return resposta.ok ? await resposta.json() : null
    } catch {
        return null
    }
}

async function nominatim(parametros: string): Promise<Coordenada | null> {
    const lido = esquemaNominatim.safeParse(
        await lerJson(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=1&${parametros}`, {
            'User-Agent': IDENTIFICACAO,
        }),
    )
    const primeiro = lido.success ? lido.data[0] : undefined
    return primeiro && Number.isFinite(primeiro.lat) && Number.isFinite(primeiro.lon)
        ? { lat: primeiro.lat, lng: primeiro.lon }
        : null
}

async function coordenadaDoCep(cep: string): Promise<Coordenada | null> {
    // 1) Endereço completo do ViaCEP. O bairro desambigua ruas com o mesmo nome.
    const endereco = esquemaViaCep.safeParse(await lerJson(`https://viacep.com.br/ws/${cep}/json/`))
    if (endereco.success && !endereco.data.erro) {
        const { logradouro, bairro, localidade, uf } = endereco.data
        if (logradouro && bairro && localidade && uf) {
            const porRua = await nominatim(`q=${encodeURIComponent(`${logradouro}, ${bairro}, ${localidade}, ${uf}`)}`)
            if (porRua) return porRua
        }
    }
    // 2) Pelo CEP, onde o OSM tem.
    return nominatim(`postalcode=${cep.slice(0, 5)}-${cep.slice(5)}`)
}

async function distanciaDeRotaKm(origem: Coordenada, destino: Coordenada): Promise<number | null> {
    const chave = process.env.ORS_API_KEY
    if (!chave) return null
    const lido = esquemaRota.safeParse(
        await lerJson(
            'https://api.openrouteservice.org/v2/directions/driving-car' +
                `?api_key=${chave}&start=${origem.lng},${origem.lat}&end=${destino.lng},${destino.lat}`,
        ),
    )
    return lido.success ? lido.data.features[0]!.properties.summary.distance / 1000 : null
}

/** Frete estimado para o CEP de entrega (server-side). Nunca lança: falha = "a combinar". */
export async function estimarFretePorCep(cepBruto: string): Promise<FreteEstimado> {
    const cep = cepBruto.replace(/\D/g, '')
    if (cep.length !== 8) return A_COMBINAR
    try {
        const { data, error } = await criarClienteServico()
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'frete_config')
            .maybeSingle()
        const config = esquemaFreteConfig.safeParse(data?.valor)
        if (error || !config.success) return A_COMBINAR

        const destino = await coordenadaDoCep(cep)
        if (!destino) return A_COMBINAR
        const distancia = await distanciaDeRotaKm(config.data.origem, destino)
        if (distancia === null) return A_COMBINAR
        return { frete: fretePorDistancia(distancia, config.data) }
    } catch (erro) {
        console.error('[loja] falha ao estimar o frete', erro)
        return A_COMBINAR
    }
}
