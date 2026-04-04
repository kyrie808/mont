import { z } from 'zod'

export const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const productSchema = z.object({
    nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
    subtitulo: z.string().optional(),
    descricao: z.string().min(10, 'A descrição deve ter pelo menos 10 caracteres'),
    preco: z.number().positive('O preço deve ser positivo'),
    categoria: z.string().min(2, 'A categoria é obrigatória'),
    estoque_atual: z.number().int().nonnegative('O estoque não pode ser negativo'),
    visivel_catalogo: z.boolean().default(true),
    destaque: z.boolean().default(false),
    url_imagem_principal: z.string().url('URL da imagem inválida').optional().or(z.literal('')),
})

export type ProdutoInput = z.infer<typeof productSchema>

export const checkoutSchema = z.object({
    nome: z.string().min(3, 'Nome é obrigatório'),
    telefone: z.string().min(10, 'Telefone inválido'),
    rua: z.string().min(3, 'Rua é obrigatória'),
    numero: z.string().min(1, 'Número é obrigatório'),
    bairro: z.string().min(2, 'Bairro é obrigatório'),
    cidade: z.string().min(2, 'Cidade é obrigatória'),
    pagamento: z.enum(['pix', 'cartao', 'dinheiro'], {
        errorMap: () => ({ message: 'Selecione uma forma de pagamento' }),
    }),
    troco: z.string().optional(),
    observacoes: z.string().optional(),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
