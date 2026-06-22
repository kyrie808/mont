import { z } from 'zod'
import { cleanPhone, isValidPhone } from '@mont/shared'

// Schema de validação para contato
export const contatoSchema = z.object({
    nome: z
        .string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres'),
    apelido: z.string().optional().nullable(),
    telefone: z
        .string()
        .min(1, 'Telefone é obrigatório')
        .refine((val) => isValidPhone(val), 'Telefone inválido')
        .transform((val) => cleanPhone(val)),
    tipo: z.enum(['B2C', 'B2B', 'FORNECEDOR']),
    subtipo: z.string().optional().nullable(),
    status: z.enum(['lead', 'cliente', 'inativo', 'fornecedor']),
    origem: z.string().min(1, 'Origem é obrigatória'),
    // Aquisição (só relevante quando origem = 'anuncio')
    fonte: z.string().optional().nullable(),
    campanha_id: z.string().uuid().optional().nullable(),
    indicado_por_id: z.string().uuid().optional().nullable(),
    endereco: z.string().optional().nullable(),
    cep: z.string().optional().nullable(),
    bairro: z.string().optional().nullable(),
    observacoes: z.string().optional().nullable(),

    // Address Breakdown
    logradouro: z.string().optional().nullable(),
    numero: z.string().optional().nullable(),
    complemento: z.string().optional().nullable(),
    cidade: z.string().optional().nullable(),
    uf: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
    // Quando a origem é Anúncio, a fonte é obrigatória (campanha é opcional).
    if (data.origem === 'anuncio' && !data.fonte) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fonte'],
            message: 'Selecione a fonte do anúncio',
        })
    }
})

export type ContatoFormData = z.infer<typeof contatoSchema>

// Schema para busca/filtros
export const contatoFiltrosSchema = z.object({
    busca: z.string().optional(),
    tipo: z.enum(['B2C', 'B2B', 'FORNECEDOR', 'todos']).default('todos'),
    status: z.enum(['lead', 'cliente', 'inativo', 'fornecedor', 'todos']).default('todos'),
    origem: z.string().default('todos'),
})

export type ContatoFiltros = z.infer<typeof contatoFiltrosSchema>
