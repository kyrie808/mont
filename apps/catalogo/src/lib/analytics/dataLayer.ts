// Tipos estritos baseados na Especificação Oficial do Google Analytics 4
export interface ItemGA4 {
    item_id: string;      // Obrigatório 
    item_name: string;    // Obrigatório
    item_category?: string;
    item_brand?: string;
    price: number;
    quantity: number;
}

export interface ViewItemListEvent {
    event: 'view_item_list';
    ecommerce: {
        item_list_id?: string;
        item_list_name?: string;
        items: ItemGA4[];
    };
}

export interface ViewItemEvent {
    event: 'view_item';
    ecommerce: {
        currency: 'BRL';
        value: number;
        items: ItemGA4[];
    };
}

export interface AddToCartEvent {
    event: 'add_to_cart';
    ecommerce: {
        currency: 'BRL';
        value: number;
        items: ItemGA4[];
    };
}

export interface RemoveFromCartEvent {
    event: 'remove_from_cart';
    ecommerce: {
        currency: 'BRL';
        value: number;
        items: ItemGA4[];
    };
}

export interface BeginCheckoutEvent {
    event: 'begin_checkout';
    ecommerce: {
        currency: 'BRL';
        value: number;
        coupon?: string;
        items: ItemGA4[];
    };
}

export interface PurchaseEvent {
    event: 'purchase';
    ecommerce: {
        transaction_id: string; // Obrigatório no nosso setup para deduplicação (UUID pedido.id)
        currency: 'BRL';
        value: number;
        tax?: number;
        shipping?: number;
        coupon?: string;
        items: ItemGA4[];
    };
}

// Eventos Costumizados
export interface WhatsappClickEvent {
    event: 'whatsapp_click';
    click_location: 'navbar' | 'footer' | 'final_cta' | 'other';
    page_path?: string;
}

export interface WhatsappSupportClickEvent {
    event: 'whatsapp_support_click';
    issue: 'cep_support' | 'other';
}

// Discriminator de Eventos Atendidos
export type TrackingEvent =
    | ViewItemListEvent
    | ViewItemEvent
    | AddToCartEvent
    | RemoveFromCartEvent
    | BeginCheckoutEvent
    | PurchaseEvent
    | WhatsappClickEvent
    | WhatsappSupportClickEvent;

// Definimos strict globals apenas dentro do nosso helper para evitar colisões amplas
declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
    }
}

/**
 * Encaminha de forma segura um payload tipado para o Google Tag Manager / Global Site Tag
 * É encapsulado em try-catch para prevenir crashes catastróficos no funil de venda.
 */
export const pushEvent = (eventData: TrackingEvent) => {
    try {
        if (typeof window !== 'undefined') {
            window.dataLayer = window.dataLayer || [];
            // O TS entende que eventData estende os atributos restritos que definimos via union
            window.dataLayer.push(eventData as unknown as Record<string, unknown>);
        }
    } catch (error) {
        // [CRÍTICO] Apenas avisa internamente. O Tracking NUNCA pode quebrar o app React.
        console.warn('[Analytics Error] Falha ao enviar evento para o dataLayer', error);
    }
};
