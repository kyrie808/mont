import { z } from 'zod'
import type { ItemAgenda, ItemSemData } from '@mont/shared'

// Fronteira com o banco da Agenda (agenda_itens / agenda_atrasados / agenda_sem_data).
// O gerador do Supabase marca toda coluna de RETURNS TABLE como não-nula; aqui fica a
// nulidade real e o vocabulário fechado de `origem`. Linha fora do formato não entra na tela.

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const numero = z.coerce.number()

export const itemAgendaSchema: z.ZodType<ItemAgenda> = z.object({
    origem: z.enum(['lembrete', 'vencimento', 'entrega', 'conta_pagar', 'retomada']),
    id: z.string().uuid(),
    data: dia,
    hora: z.string().nullable(),
    titulo: z.string(),
    descricao: z.string().nullable(),
    tipo: z.string().nullable(),
    situacao: z.string(),
    atrasado: z.boolean(),
    contato_id: z.string().uuid().nullable(),
    contato_nome: z.string().nullable(),
    contato_telefone: z.string().nullable(),
    venda_id: z.string().uuid().nullable(),
    forma_pagamento: z.string().nullable(),
    valor: numero.nullable(),
    responsavel: z.string().nullable(),
})

export const itemSemDataSchema: z.ZodType<ItemSemData> = z.object({
    venda_id: z.string().uuid(),
    data_venda: dia,
    dias_em_aberto: z.number(),
    contato_id: z.string().uuid(),
    contato_nome: z.string(),
    contato_telefone: z.string(),
    forma_pagamento: z.string(),
    status: z.string(),
    valor: numero,
})

export const TIPOS_LEMBRETE = ['cobranca', 'parcela', 'pendencia_interna', 'retorno_comercial', 'outro'] as const
export type TipoLembrete = (typeof TIPOS_LEMBRETE)[number]

export const RESPONSAVEIS = ['luccas', 'gilmar', 'equipe'] as const
export type Responsavel = (typeof RESPONSAVEIS)[number]

/** Criação rápida — o que a tela manda; o banco carimba auditoria, contador e conclusão. */
export const novoLembreteSchema = z.object({
    titulo: z.string().trim().min(1, 'Dê um título'),
    data: dia,
    hora: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
    tipo: z.enum(TIPOS_LEMBRETE),
    descricao: z.string().trim().nullable(),
    contato_id: z.string().uuid().nullable(),
    venda_id: z.string().uuid().nullable(),
    responsavel: z.enum(RESPONSAVEIS).nullable(),
    valor: z.number().positive('Valor tem que ser maior que zero').nullable(),
})
export type NovoLembrete = z.infer<typeof novoLembreteSchema>
