import { z } from 'zod'

// Item de venda
export const itemVendaSchema = z.object({
    produto_id: z.uuid(),
    quantidade: z.number().min(0.001, 'Quantidade inválida'),
    preco_unitario: z.number().min(0.01, 'Preço inválido'),
    subtotal: z.number(),
})

export type ItemVendaFormData = z.infer<typeof itemVendaSchema>

// Venda completa
export const vendaSchema = z.object({
    contato_id: z.uuid({ error: 'Selecione um cliente' }),
    data: z.string(),
    data_entrega: z.string().optional().nullable(),
    forma_pagamento: z.enum(['pix', 'dinheiro', 'cartao', 'fiado', 'brinde', 'pre_venda']),
    observacoes: z.string().optional().nullable(),
    taxa_entrega: z.number().min(0).default(0),
    itens: z.array(itemVendaSchema).min(1, 'Adicione pelo menos um produto'),
    parcelas: z.number().int().min(1).default(1),
    data_prevista_pagamento: z.string().optional().nullable(),
}).refine((data) => {
    if (data.forma_pagamento === 'fiado' && !data.data_prevista_pagamento) {
        return false
    }
    return true
}, {
    message: "Informe a data prevista de pagamento para vendas fiado",
    path: ["data_prevista_pagamento"],
})

export type VendaFormData = z.infer<typeof vendaSchema>

// Filtros de venda
export const vendaFiltrosSchema = z.object({
    status: z.enum(['pendente', 'entregue', 'cancelada', 'todos']).default('todos'),
    forma_pagamento: z.enum(['pix', 'dinheiro', 'cartao', 'fiado', 'brinde', 'pre_venda', 'todos']).default('todos'),
    periodo: z.enum(['hoje', 'semana', 'mes', 'todos']).default('todos'),
    contatoId: z.string().optional(),
    search: z.string().optional(),
})

export type VendaFiltros = z.infer<typeof vendaFiltrosSchema>

export const pagamentoSchema = z.object({
    venda_id: z.uuid(),
    valor: z.number().min(0.01, 'Valor deve ser maior que zero'),
    data: z.string().refine((val) => {
        const date = new Date(val);
        const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).split(' ')[0];
        const endOfToday = new Date(`${todayStr}T23:59:59`);
        return date <= endOfToday;
    }, 'A data de pagamento não pode ser futura'),
    metodo: z.enum(['pix', 'dinheiro', 'cartao', 'fiado', 'brinde', 'pre_venda']).default('pix'),
    conta_id: z.uuid({ error: 'Selecione uma conta de destino' }),
    observacao: z.string().optional(),
})

export type PagamentoFormData = z.infer<typeof pagamentoSchema>
