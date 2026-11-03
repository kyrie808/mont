import { z } from 'zod'

// Aba "Loja" do produto (complemento da vitrine da loja, tabela loja_vitrine).
// Tudo opcional: vazio = vale o cadastro. Os limites espelham os CHECKs do banco.

const umaLinha = (max: number, campo: string) =>
    z
        .string()
        .trim()
        .max(max, `${campo}: no máximo ${max} caracteres`)
        .refine((v) => !/[\r\n]/.test(v), `${campo}: uma linha só`)

export const lojaProdutoSchema = z.object({
    nomeLoja: umaLinha(120, 'Nome na loja'),
    fraseCard: umaLinha(80, 'Frase do card'),
    resumo: umaLinha(160, 'Resumo do combo'),
    /** '' = a seção do cadastro. */
    secaoId: z.union([z.literal(''), z.string().uuid()]),
    /** '' = a ordem da tela Catálogo. */
    ordemLoja: z.union([z.literal(''), z.string().regex(/^\d{1,4}$/, 'Ordem na loja: número inteiro')]),
    destaqueHero: z.boolean(),
    levaJunto: z.boolean(),
    esgotado: z.boolean(),
    usaEstoque: z.boolean(),
    usarAncoragem: z.boolean(),
})

export type LojaProdutoForm = z.infer<typeof lojaProdutoSchema>

export const LOJA_PRODUTO_PADRAO: LojaProdutoForm = {
    nomeLoja: '',
    fraseCard: '',
    resumo: '',
    secaoId: '',
    ordemLoja: '',
    destaqueHero: false,
    levaJunto: false,
    esgotado: false,
    usaEstoque: false,
    usarAncoragem: false,
}
