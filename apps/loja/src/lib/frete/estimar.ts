import { z } from 'zod'
import { criarClienteServico } from '@/lib/supabase/servico'
import { esquemaFreteConfig, fretePorDistancia, normalizarCidade, valorDaRegiao, type FreteEstimado } from './calculo'

// Só no servidor (server actions da loja): usa a chave de serviço e a ORS_API_KEY.
// CEP → ViaCEP (cidade). Cidade do ABC → valor fixo da região, sem distância.
// Fora dele: coordenada → distância de ROTA (OpenRouteService) → faixa de frete. A coordenada sai
// do Nominatim (rua + bairro + cidade, depois o CEP) e, se ele falhar, do geocodificador do próprio
// OpenRouteService (mesma chave), aceito só se cair na mesma cidade do CEP. NUNCA linha reta nem
// centroide de bairro (subcobraria ou cobraria a faixa errada). Qualquer falha vira "a combinar".

type Coordenada = { lat: number; lng: number }
type Endereco = { logradouro: string; bairro: string; cidade: string; uf: string }

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
const esquemaGeocodeOrs = z.object({
    features: z.array(
        z.object({
            geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
            properties: z.object({
                locality: z.string().optional(),
                localadmin: z.string().optional(),
                county: z.string().optional(),
            }),
        }),
    ),
})

async function lerJson(url: string, cabecalhos?: Record<string, string>): Promise<unknown> {
    try {
        const resposta = await fetch(url, { headers: cabecalhos, next: { revalidate: DIA }, signal: AbortSignal.timeout(6000) })
        return resposta.ok ? await resposta.json() : null
    } catch {
        return null
    }
}

async function enderecoDoCep(cep: string): Promise<Endereco | null> {
    const lido = esquemaViaCep.safeParse(await lerJson(`https://viacep.com.br/ws/${cep}/json/`))
    if (!lido.success || lido.data.erro || !lido.data.localidade || !lido.data.uf) return null
    return {
        logradouro: lido.data.logradouro ?? '',
        bairro: lido.data.bairro ?? '',
        cidade: lido.data.localidade,
        uf: lido.data.uf,
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

/** Geocodificador do OpenRouteService (Pelias), aceito só se o resultado estiver na cidade do CEP. */
async function geocodeOrs(e: Endereco, chave: string): Promise<Coordenada | null> {
    if (!e.logradouro) return null
    const parametros = new URLSearchParams({
        api_key: chave,
        address: e.logradouro,
        locality: e.cidade,
        region: e.uf,
        country: 'BRA',
        size: '1',
    })
    if (e.bairro) parametros.set('neighbourhood', e.bairro)
    const lido = esquemaGeocodeOrs.safeParse(
        await lerJson(`https://api.openrouteservice.org/geocode/search/structured?${parametros}`),
    )
    const primeiro = lido.success ? lido.data.features[0] : undefined
    if (!primeiro) return null
    const { locality, localadmin, county } = primeiro.properties
    const cidade = normalizarCidade(e.cidade)
    if (![locality, localadmin, county].some((c) => c !== undefined && normalizarCidade(c) === cidade)) return null
    const [lng, lat] = primeiro.geometry.coordinates
    return { lat, lng }
}

async function coordenada(cep: string, e: Endereco, chave: string): Promise<Coordenada | null> {
    // 1) Rua + bairro + cidade (o bairro desambigua ruas com o mesmo nome). 2) Pelo CEP, onde o OSM tem.
    if (e.logradouro && e.bairro) {
        const porRua = await nominatim(`q=${encodeURIComponent(`${e.logradouro}, ${e.bairro}, ${e.cidade}, ${e.uf}`)}`)
        if (porRua) return porRua
    }
    const porCep = await nominatim(`postalcode=${cep.slice(0, 5)}-${cep.slice(5)}`)
    if (porCep) return porCep
    // 3) Geocodificador do OpenRouteService.
    return geocodeOrs(e, chave)
}

async function distanciaDeRotaKm(origem: Coordenada, destino: Coordenada, chave: string): Promise<number | null> {
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

        // Sem a cidade do CEP não dá para saber se é ABC: melhor "a combinar" do que cobrar a faixa errada.
        const endereco = await enderecoDoCep(cep)
        if (!endereco) return A_COMBINAR
        const fixo = valorDaRegiao(endereco.cidade, config.data)
        if (fixo !== null) return { frete: fixo }

        const chave = process.env.ORS_API_KEY
        if (!chave) return A_COMBINAR
        const destino = await coordenada(cep, endereco, chave)
        if (!destino) return A_COMBINAR
        const distancia = await distanciaDeRotaKm(config.data.origem, destino, chave)
        if (distancia === null) return A_COMBINAR
        return { frete: fretePorDistancia(distancia, config.data) }
    } catch (erro) {
        console.error('[loja] falha ao estimar o frete', erro)
        return A_COMBINAR
    }
}
