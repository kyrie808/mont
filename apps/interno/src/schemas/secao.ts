import { z } from 'zod'

// Descrição da seção (cat_secoes.descricao): frase sob o título da seção na loja.
// Espelha o CHECK do banco: uma linha, até 120 caracteres. Vazio = sem descrição (NULL).
export const descricaoSecaoSchema = z
    .string()
    .trim()
    .max(120, 'Descrição da seção: no máximo 120 caracteres')
    .refine((v) => !/[\r\n]/.test(v), 'Descrição da seção: uma linha só')
    .transform((v) => (v === '' ? null : v))
