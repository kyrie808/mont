import { z } from 'zod'

// A sacola guarda só identificadores e quantidades. Preço nunca vem daqui:
// a tela calcula a partir da vitrine do servidor, e o pedido (Fase 2) recalcula tudo no banco.

const quantidade = z.number().int().min(1).max(99)

export const esquemaItemProduto = z.object({
    tipo: z.literal('produto'),
    produtoId: z.guid(),
    quantidade,
})

export const esquemaEscolha = z.object({
    grupoId: z.guid(),
    produtoId: z.guid(),
    quantidade,
})

export const esquemaItemCombo = z.object({
    tipo: z.literal('combo'),
    chave: z.string().min(1).max(64),
    comboId: z.guid(),
    escolhas: z.array(esquemaEscolha).max(50),
})

export const esquemaItemSacola = z.discriminatedUnion('tipo', [esquemaItemProduto, esquemaItemCombo])

export const esquemaSacolaPersistida = z.object({
    itens: z.array(esquemaItemSacola).max(100),
    bairroId: z.guid().nullable(),
})

export type ItemProduto = z.infer<typeof esquemaItemProduto>
export type ItemCombo = z.infer<typeof esquemaItemCombo>
export type ItemSacola = z.infer<typeof esquemaItemSacola>
export type Escolha = z.infer<typeof esquemaEscolha>
export type SacolaPersistida = z.infer<typeof esquemaSacolaPersistida>
