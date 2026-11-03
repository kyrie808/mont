/**
 * Eventos da loja para o GTM (`GTM-W6CXZC3R`, o mesmo do catálogo antigo).
 *
 * O pixel da Meta vive SÓ no GTM (nenhum `fbq` no código). As tags de lá escutam estes nomes:
 *   view_item      → Meta ViewContent (+ GA4)
 *   add_to_cart    → Meta AddToCart (+ GA4)
 *   begin_checkout → GA4; Meta InitiateCheckout pela tag que lê `event_id` começando com `checkout_`
 *   whatsapp_click → Meta Lead com eventID = event_id (+ GA4 + conversão do Google Ads)
 * O mesmo `event_id` sai pelo servidor (API de Conversões), e a Meta conta uma vez só.
 *
 * Sem dado pessoal aqui: nome, telefone e endereço nunca vão para o dataLayer.
 */

export interface ItemGA4 {
    item_id: string
    item_name: string
    price: number
    quantity: number
}

type EventoComercio = {
    event: 'view_item' | 'add_to_cart'
    ecommerce: { currency: 'BRL'; value: number; items: ItemGA4[] }
}

type InicioCheckout = {
    event: 'begin_checkout'
    event_id: string
    ecommerce: { currency: 'BRL'; value: number; items: ItemGA4[] }
}

type CliqueWhatsApp = {
    event: 'whatsapp_click'
    event_id: string
    click_location: 'enviar_pedido'
}

export type EventoLoja = EventoComercio | InicioCheckout | CliqueWhatsApp

declare global {
    interface Window {
        dataLayer?: Record<string, unknown>[]
    }
}

export function itemGA4(produto: { id: string; nome: string; preco: number }, quantidade: number): ItemGA4 {
    return { item_id: produto.id, item_name: produto.nome, price: produto.preco, quantity: quantidade }
}

function empurrar(dado: Record<string, unknown>): void {
    window.dataLayer = window.dataLayer ?? []
    window.dataLayer.push(dado)
}

/** Medição nunca pode quebrar a loja. */
export function medir(evento: EventoLoja): void {
    try {
        if (typeof window === 'undefined') return
        // O GTM funde objetos entre pushes: sem limpar, itens do evento anterior vazam no próximo.
        if ('ecommerce' in evento) empurrar({ ecommerce: null })
        empurrar(evento)
    } catch (erro) {
        console.warn('[medição] falha ao enviar para o dataLayer', erro)
    }
}

export function medirVisualizacao(produto: { id: string; nome: string; preco: number }): void {
    medir({ event: 'view_item', ecommerce: { currency: 'BRL', value: produto.preco, items: [itemGA4(produto, 1)] } })
}

export function medirAdicao(produto: { id: string; nome: string; preco: number }, quantidade = 1): void {
    if (quantidade <= 0) return
    medir({
        event: 'add_to_cart',
        ecommerce: { currency: 'BRL', value: produto.preco * quantidade, items: [itemGA4(produto, quantidade)] },
    })
}
