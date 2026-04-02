import { z } from 'zod'
import { isValidPhone } from '@/lib/utils/format'

export const checkoutSchema = z.object({
    customer_name: z.string().min(3, 'Nome muito curto'),
    customer_phone: z.string().refine(isValidPhone, 'Telefone inválido'),
    delivery_method: z.enum(['entrega', 'retirada']),
    payment_method: z.enum(['pix', 'dinheiro']),
    // Campos de endereço — montados em customer_address no onSubmit
    cep: z.string().optional(),
    logradouro: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
    referred_by: z.string().optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.delivery_method === 'entrega') {
        const cleanCep = (data.cep || '').replace(/\D/g, '')
        if (cleanCep.length !== 8) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'CEP obrigatório para entrega',
                path: ['cep'],
            })
        }
        if (!data.numero || data.numero.trim() === '') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Número obrigatório para entrega',
                path: ['numero'],
            })
        }
    }
})

export type CheckoutFormData = z.infer<typeof checkoutSchema>
