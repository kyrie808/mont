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
    origem: z.enum(['direto', 'indicacao', 'catalogo']),
    indicado_por_id: z.uuid().optional().nullable(),
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
})

export type ContatoFormData = z.infer<typeof contatoSchema>

// Schema para busca/filtros
export const contatoFiltrosSchema = z.object({
    busca: z.string().optional(),
    tipo: z.enum(['B2C', 'B2B', 'FORNECEDOR', 'todos']).default('todos'),
    status: z.enum(['lead', 'cliente', 'inativo', 'fornecedor', 'todos']).default('todos'),
    origem: z.enum(['direto', 'indicacao', 'catalogo', 'todos']).default('todos'),
})

export type ContatoFiltros = z.infer<typeof contatoFiltrosSchema>
