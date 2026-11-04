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
                layer: z.string().optional(),
                match_type: z.string().optional(),
                locality: z.string().optional(),
                localadmin: z.string().optional(),
                county: z.string().optional(),
            }),
        }),
    ),
})

/** Só rua ou endereço: centro de bairro ou de cidade cobraria a faixa errada. */
const CAMADAS_PRECISAS = new Set(['address', 'street'])

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

type CoordenadaOrs = Coordenada & { camada: string }

/** Primeiro resultado do OpenRouteService que seja rua/endereço (sem "fallback") na cidade do CEP. */
async function primeiroAceito(url: string, cidadeDoCep: string): Promise<CoordenadaOrs | null> {
    const lido = esquemaGeocodeOrs.safeParse(await lerJson(url))
    if (!lido.success) return null
    const cidade = normalizarCidade(cidadeDoCep)
    for (const f of lido.data.features) {
        const { layer, match_type, locality, localadmin, county } = f.properties
        if (!layer || !CAMADAS_PRECISAS.has(layer) || match_type === 'fallback') continue
        if (![locality, localadmin, county].some((c) => c !== undefined && normalizarCidade(c) === cidade)) continue
        const [lng, lat] = f.geometry.coordinates
        return { lat, lng, camada: layer }
    }
    return null
}

/** Geocodificador do OpenRouteService (Pelias): estruturado e, se não achar, por texto livre. */
async function geocodeOrs(e: Endereco, chave: string): Promise<CoordenadaOrs | null> {
    if (!e.logradouro) return null
    const estruturado = new URLSearchParams({
        api_key: chave,
        address: e.logradouro,
        locality: e.cidade,
        region: e.uf,
        country: 'BRA',
        layers: 'address,street',
        size: '5',
    })
    if (e.bairro) estruturado.set('neighbourhood', e.bairro)
    const achado = await primeiroAceito(`https://api.openrouteservice.org/geocode/search/structured?${estruturado}`, e.cidade)
    if (achado) return achado
    const texto = new URLSearchParams({
        api_key: chave,
        text: [e.logradouro, e.bairro, e.cidade, e.uf].filter(Boolean).join(', '),
        'boundary.country': 'BRA',
        layers: 'address,street',
        size: '5',
    })
    return primeiroAceito(`https://api.openrouteservice.org/geocode/search?${texto}`, e.cidade)
}

async function coordenada(cep: string, e: Endereco, chave: string): Promise<(Coordenada & { fonte: string }) | null> {
    // 1) Rua + bairro + cidade (o bairro desambigua ruas com o mesmo nome). 2) Pelo CEP, onde o OSM tem.
    if (e.logradouro && e.bairro) {
        const porRua = await nominatim(`q=${encodeURIComponent(`${e.logradouro}, ${e.bairro}, ${e.cidade}, ${e.uf}`)}`)
        if (porRua) return { ...porRua, fonte: 'nominatim-rua' }
    }
    const porCep = await nominatim(`postalcode=${cep.slice(0, 5)}-${cep.slice(5)}`)
    if (porCep) return { ...porCep, fonte: 'nominatim-cep' }
    // 3) Geocodificador do OpenRouteService.
    const ors = await geocodeOrs(e, chave)
    return ors ? { lat: ors.lat, lng: ors.lng, fonte: `ors-${ors.camada}` } : null
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
        const frete = fretePorDistancia(distancia, config.data)
        // Conferência das faixas fora do ABC: de onde veio o ponto e a distância (sem dado pessoal).
        console.info('[frete]', cep.slice(0, 5), destino.fonte, `${distancia.toFixed(1)} km`, frete ?? 'a combinar')
        return { frete }
    } catch (erro) {
        console.error('[loja] falha ao estimar o frete', erro)
        return A_COMBINAR
    }
}
