// CEP → coordenadas (server-side), preciso a nível de RUA, gratuito (sem chave/cartão) e
// funcionando do IP do Vercel: ViaCEP (rua, qualquer IP) + Nominatim (OSM). A AwesomeAPI
// tem o coord exato mas bloqueia o IP de datacenter do Vercel. Estratégia:
//   1) Nominatim pelo ENDEREÇO completo do ViaCEP (rua + bairro + cidade + UF). O bairro é
//      ESSENCIAL: sem ele o OSM casa rua homônima a km de distância. Preciso (~0,3 km).
//   2) Nominatim por CEP (postalcode) — preciso onde o OSM tem o CEP.
//   senão → null = "a combinar". SEM centroide de bairro: era impreciso (~2 km) e
//   superfaturava CEPs perto da origem (cobrava faixa errada). Melhor "a combinar".

type Coord = { lat: number; lng: number }
const DAY = 60 * 60 * 24 // CEP→coordenada é estável; cache de 24h.
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
): Promise<{ logradouro?: string; bairro?: string; localidade?: string; uf?: string } | null> {
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { next: { revalidate: DAY } })
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

    // 1) Endereço completo (rua) via ViaCEP → Nominatim. Exige bairro pra desambiguar
    //    ruas homônimas (sem ele o OSM casa a rua errada, a km de distância).
    const addr = await viaCep(clean)
    if (addr?.logradouro && addr.bairro && addr.localidade && addr.uf) {
        const q = `${addr.logradouro}, ${addr.bairro}, ${addr.localidade}, ${addr.uf}`
        const porRua = await nominatim(`q=${encodeURIComponent(q)}`)
        if (porRua) return porRua
    }

    // 2) CEP (postalcode) — preciso onde o OSM tem o CEP.
    return nominatim(`postalcode=${formatado}`)
    // senão null = "a combinar" (nunca centroide de bairro).
}
