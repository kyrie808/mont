import { getFreteConfig } from './config'
import { geocodeCep } from './geocode'
import { haversineKm, calcularFretePorDistancia } from './calc'
import type { FreteResultado } from './types'

/** Calcula o frete para um CEP de destino (server-side). Degrada para "a combinar". */
export async function calcularFreteParaCep(cep: string): Promise<FreteResultado> {
    const config = await getFreteConfig()
    if (!config) return { disponivel: false, frete: 0, distanciaKm: null, motivo: 'sem_config' }

    const destino = await geocodeCep(cep)
    if (!destino) return { disponivel: false, frete: 0, distanciaKm: null, motivo: 'sem_coordenada' }

    const distanciaKm = haversineKm(config.origem, destino)
    const frete = calcularFretePorDistancia(distanciaKm, config)
    if (frete == null) return { disponivel: false, frete: 0, distanciaKm, motivo: 'fora_alcance' }

    return { disponivel: true, frete, distanciaKm, motivo: 'ok' }
}

export * from './types'
