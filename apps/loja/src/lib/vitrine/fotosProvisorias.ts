/**
 * Fotos PROVISÓRIAS dos combos da Black (02/11/2026): composição automática com as fotos dos produtos
 * (item principal atrás, potes genéricos na frente, fundo areia), em apps/loja/public/combos/.
 *
 * Como trocar pela foto definitiva (Flow): cadastrar a foto como capa do produto no sistema interno.
 * A capa cadastrada sempre vence esta lista; quando todas chegarem, apague a lista e a pasta.
 */
const FOTOS_PROVISORIAS: Readonly<Record<string, string>> = {
    combo_black_familia: '/combos/combo_black_familia.webp',
    combo_black_balde_doce: '/combos/combo_black_balde_doce.webp',
    combo_black_3_doces: '/combos/combo_black_3_doces.webp',
    combo_black_cafe_da_tarde: '/combos/combo_black_cafe_da_tarde.webp',
    combo_black_dupla_zero: '/combos/combo_black_dupla_zero.webp',
}

export function fotoProvisoria(codigo: string | null): string | null {
    return codigo ? (FOTOS_PROVISORIAS[codigo] ?? null) : null
}
