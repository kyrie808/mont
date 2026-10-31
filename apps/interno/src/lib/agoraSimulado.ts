import { z } from 'zod'

/**
 * Data simulada: ver a Black (preço de campanha na Nova Venda) antes de 03/11, no preview da
 * Vercel ou no dev local. Mesmo padrão do LOJA_AGORA da loja.
 *
 * Em produção ela NUNCA vale. Três travas independentes, qualquer uma basta:
 *   1. build de produção da Vercel (`VITE_VERCEL_ENV`, injetada pela Vercel em projeto Vite);
 *   2. página aberta no domínio de produção (cobre a 1 se a variável não chegar ao build);
 *   3. valor que não é data ISO com fuso (ex.: 2026-11-03T10:00:00-03:00).
 *
 * Com data simulada a venda NÃO é gravada (ver NovaVenda): o preview usa o banco de produção,
 * e o servidor precifica pela hora real.
 */

export const HOST_PRODUCAO = 'sistema.montdistribuidora.com.br'

const esquemaAgora = z.iso.datetime({ offset: true })

interface AmbienteAgora {
    VITE_VERCEL_ENV?: string
    VITE_AGORA_SIMULADO?: string
}

/** ISO em UTC do instante simulado, ou `null` para a hora real. */
export function lerAgoraSimulado(env: AmbienteAgora, hostname: string): string | null {
    if (env.VITE_VERCEL_ENV === 'production') return null
    if (hostname === HOST_PRODUCAO) return null
    const lido = esquemaAgora.safeParse(env.VITE_AGORA_SIMULADO)
    return lido.success ? new Date(lido.data).toISOString() : null
}

/** O instante simulado deste build, ou `null` (produção, ou variável ausente/ inválida). */
export const agoraSimulado: string | null = lerAgoraSimulado(
    {
        VITE_VERCEL_ENV: import.meta.env.VITE_VERCEL_ENV,
        VITE_AGORA_SIMULADO: import.meta.env.VITE_AGORA_SIMULADO,
    },
    typeof window === 'undefined' ? '' : window.location.hostname,
)
