// Distância de ROTA (dirigindo) via OpenRouteService — a distância de rua, não a linha
// reta. Free tier (2.000/dia), sem cartão; funciona do IP do Vercel. Requer ORS_API_KEY
// (server-only, sem prefixo NEXT_PUBLIC). Retorna km ou null — null faz o frete cair pra
// "a combinar" (nunca cobramos por linha reta, que subcobraria).

const DAY = 60 * 60 * 24 // origem→destino é estável por CEP; cache de 24h.

export async function roadDistanceKm(
    origem: { lat: number; lng: number },
    destino: { lat: number; lng: number },
): Promise<number | null> {
    const key = process.env.ORS_API_KEY
    if (!key) return null

    try {
        const res = await fetch(
            'https://api.openrouteservice.org/v2/directions/driving-car' +
                `?api_key=${key}&start=${origem.lng},${origem.lat}&end=${destino.lng},${destino.lat}`,
            { next: { revalidate: DAY } },
        )
        if (!res.ok) return null

        const data = await res.json()
        const meters = data?.features?.[0]?.properties?.summary?.distance
        return Number.isFinite(meters) ? Number(meters) / 1000 : null
    } catch {
        return null
    }
}
