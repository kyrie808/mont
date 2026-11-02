import { z } from 'zod'

/** Pedido recém-enviado, guardado na aba para a tela 07 (sobrevive a recarregar a página). */
const CHAVE = 'mont-loja:pedido-enviado'

const esquemaEnviado = z.object({
    numero: z.number().int().positive(),
    link: z.string().startsWith('https://wa.me/'),
    whatsappAberto: z.boolean(),
})

export type PedidoEnviado = z.infer<typeof esquemaEnviado>

export function guardarEnviado(pedido: PedidoEnviado): void {
    sessionStorage.setItem(CHAVE, JSON.stringify(pedido))
}

/** O texto guardado, como está (estável entre renders, para o useSyncExternalStore). */
export function lerEnviadoBruto(): string | null {
    return sessionStorage.getItem(CHAVE)
}

export function interpretarEnviado(bruto: string | null): PedidoEnviado | null {
    try {
        const lido = esquemaEnviado.safeParse(JSON.parse(bruto ?? 'null'))
        return lido.success ? lido.data : null
    } catch {
        return null
    }
}

/**
 * UUID v4 para a chave do envio (o banco devolve o mesmo pedido se ela chegar de novo).
 * Não usa crypto.randomUUID: no celular via http da rede local ele não existe.
 */
export function novaChavePedido(): string {
    const b = crypto.getRandomValues(new Uint8Array(16))
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
