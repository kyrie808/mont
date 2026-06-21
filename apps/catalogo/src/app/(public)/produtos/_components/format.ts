export const brl = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// "R$ 30" sem centavos quando inteiro (padrão do mock de referência)
export const brlCompact = (v: number) =>
    v % 1 === 0 ? `R$ ${v.toLocaleString('pt-BR')}` : brl(v)

// Percentual de desconto REAL a partir do preço-âncora. Pressupõe ancora > preco
// (o mesmo guard `temAncora` usado nos componentes). Nunca hardcodado.
export const descontoPct = (ancora: number, preco: number) =>
    Math.round(((ancora - preco) / ancora) * 100)
