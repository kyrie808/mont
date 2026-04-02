import { z } from 'zod'

export const productSchema = z.object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    description: z.string().optional(),
    category: z.enum(['congelado', 'refrigerado']),
    subtitle: z.string().optional(),
    price_cents: z.number().int().positive('Preço deve ser positivo'),
    stock_quantity: z.number().int().nonnegative('Estoque não pode ser negativo'),
})

export const orderSchema = z.object({
    customer_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    customer_phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido (use apenas números)'),
    customer_address: z.string().optional(),
    delivery_method: z.enum(['entrega', 'retirada']),
    notes: z.string().optional(),
    referred_by: z.string().optional(),
})

export type ProductInput = z.infer<typeof productSchema>
export type OrderInput = z.infer<typeof orderSchema>
