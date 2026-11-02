/** Abaixo disto o selo "Economize R$ X" não aparece (o "separado" riscado continua). Decisão do Luccas, 02/11. */
export const ECONOMIA_MINIMA_DO_SELO = 15

export function mostraSeloEconomia(economia: number | null): boolean {
    return economia !== null && Math.round(economia * 100) >= ECONOMIA_MINIMA_DO_SELO * 100
}

/**
 * Quanto o combo economiza em relação a comprar os itens separados.
 * A âncora é a soma dos avulsos com o sabor mais barato de cada grupo (decisão P4), então o valor é
 * a economia MÍNIMA: com sabores mais caros ela só aumenta. Sem âncora (ou sem vantagem), null.
 */
export function economiaDoCombo({ preco, ancora }: { preco: number; ancora: number | null }): number | null {
    if (ancora === null) return null
    const centavos = Math.round(ancora * 100) - Math.round(preco * 100)
    return centavos > 0 ? centavos / 100 : null
}
