/**
 * Origem de aquisição do contato (de onde ele veio) → rótulo + classes de badge.
 * Diferente do SEGMENTO (ciclo de vida): a origem é fixa (como chegou), o segmento muda
 * com as compras. Anúncio + fonte meta_ads = "Meta Ads" (destaque, tráfego pago).
 */
const FONTE_LABEL: Record<string, string> = {
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    tiktok_ads: 'TikTok Ads',
}

// Estilos por token do DS. Anúncio ganha destaque de marca (aquisição paga); o resto é neutro.
const NEUTRO = 'bg-muted text-muted-foreground border-border'
const DESTAQUE = 'bg-primary/5 text-primary border-primary/30'

// ESPELHADO NO BANCO: fn_contatos_segmento (migração 20261106215818) aplica esta mesma regra para
// Gestão de Clientes. Mudou aqui, muda lá, e roda supabase/tests/contatos_segmento_paridade.mjs.
export function origemBadge(
    origem: string | null | undefined,
    fonte?: string | null,
): { label: string; cls: string } {
    switch (origem) {
        case 'anuncio':
            return { label: (fonte && FONTE_LABEL[fonte]) || 'Anúncio', cls: DESTAQUE }
        case 'indicacao':
            return { label: 'Indicação', cls: NEUTRO }
        case 'catalogo':
            return { label: 'Catálogo', cls: NEUTRO }
        case 'facebook':
            return { label: 'Facebook', cls: DESTAQUE }
        case 'direto':
            return { label: 'Direto', cls: NEUTRO }
        case 'whatsapp':
            // Explícito por causa do caixa-alta do meio: o default entregaria "Whatsapp".
            return { label: 'WhatsApp', cls: NEUTRO }
        default:
            return { label: origem ? origem.charAt(0).toUpperCase() + origem.slice(1) : '—', cls: NEUTRO }
    }
}
