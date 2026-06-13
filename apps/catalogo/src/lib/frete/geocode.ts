// CEP → coordenadas via AwesomeAPI (server-side, sem chave). Usada só no servidor para
// evitar CORS e manter o cálculo do frete autoritativo. Retorna null se o CEP não tiver
// coordenada (→ frete "a combinar"). NÃO usar a BrasilAPI v2 aqui: muitos CEPs vêm sem
// location (ex.: o open-cep devolve coordinates vazio).

export async function geocodeCep(cep: string): Promise<{ lat: number; lng: number } | null> {
    const clean = (cep || '').replace(/\D/g, '')
    if (clean.length !== 8) return null

    try {
        const res = await fetch(`https://cep.awesomeapi.com.br/json/${clean}`, {
            next: { revalidate: 60 * 60 * 24 }, // CEP→coordenada é estável; cache de 24h
        })
        if (!res.ok) return null

        const data = await res.json()
        const lat = parseFloat(data?.lat)
        const lng = parseFloat(data?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

        return { lat, lng }
    } catch {
        return null
    }
}
