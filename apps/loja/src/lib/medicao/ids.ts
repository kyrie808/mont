/**
 * `event_id` dos eventos do checkout, derivados da chave do envio (uma por visita à tela 05).
 * Navegador (GTM) e servidor (API de Conversões) usam o mesmo id, e a Meta conta uma vez só;
 * tocar de novo em "Enviar" repete o id, então também não conta em dobro.
 */
export const idInicioCheckout = (chave: string) => `checkout_${chave}`
export const idLead = (chave: string) => `lead_${chave}`
