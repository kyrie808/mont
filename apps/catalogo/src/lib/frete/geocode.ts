// CEP → coordenadas (server-side). 100% gratuito, sem chave/conta/cartão e funcionando do
// IP do Vercel: Nominatim (OpenStreetMap) + ViaCEP. A AwesomeAPI tinha a melhor precisão,
// mas bloqueia o IP de datacenter do Vercel; Google/Mapbox exigem cartão. Estratégia em
// camadas (mais precisa → mais grossa), degradando pra null (→ frete "a combinar"):
//   1) Nominatim por CEP (postalcode) — preciso onde o OSM tem o CEP.
//   2) ViaCEP (bairro) → Nominatim — cobre o ABC com precisão de bairro (~1–3 km).
//   3) ViaCEP (cidade) → Nominatim — último recurso, precisão de cidade.
// NÃO usar BrasilAPI v2 (coordinates vazio) nem street-level no Nominatim (ruas homônimas
// retornam local errado).

type Coord = { lat: number; lng: number }

const DAY = 60 * 60 * 24 // CEP→coordenada é estável; cache de 24h em cada fonte.
// Nominatim exige User-Agent identificável; sem isso a OSM responde 403.
const NOMINATIM_UA = 'MontDistribuidora/1.0 (+https://www.montdistribuidora.com.br)'

function parse(lat: unknown, lon: unknown): Coord | null {
    const la = parseFloat(String(lat))
    const ln = parseFloat(String(lon))
    return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null
}

async function nominatim(params: string): Promise<Coord | null> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=1&${params}`,
            { headers: { 'User-Agent': NOMINATIM_UA }, next: { revalidate: DAY } },
        )
        if (!res.ok) return null
        const data = await res.json()
        const first = Array.isArray(data) ? data[0] : null
        return first ? parse(first.lat, first.lon) : null
    } catch {
        return null
    }
}

async function viaCep(
    cep: string,
): Promise<{ bairro?: string; localidade?: string; uf?: string } | null> {
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
            next: { revalidate: DAY },
        })
        if (!res.ok) return null
        const data = await res.json()
        return data?.erro ? null : data
    } catch {
        return null
    }
}

export async function geocodeCep(cep: string): Promise<Coord | null> {
    const clean = (cep || '').replace(/\D/g, '')
    if (clean.length !== 8) return null
    const formatado = `${clean.slice(0, 5)}-${clean.slice(5)}`

    // 1) Nominatim por CEP (mais preciso).
    const porCep = await nominatim(`postalcode=${formatado}`)
    if (porCep) return porCep

    // 2/3) ViaCEP → Nominatim por bairro e, em último caso, por cidade.
    const addr = await viaCep(clean)
    if (!addr?.localidade || !addr?.uf) return null

    if (addr.bairro) {
        const porBairro = await nominatim(
            `q=${encodeURIComponent(`${addr.bairro}, ${addr.localidade}, ${addr.uf}, Brasil`)}`,
        )
        if (porBairro) return porBairro
    }

    return nominatim(`q=${encodeURIComponent(`${addr.localidade}, ${addr.uf}, Brasil`)}`)
}
