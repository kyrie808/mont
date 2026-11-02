import { z } from 'zod'
import { esquemaItemSacola } from '@/lib/sacola/esquema'

/** Texto do aceite exatamente como aparece na tela 05 (guardado com o pedido — LGPD). */
export const TEXTO_OFERTAS = 'Quero receber ofertas da Mont no WhatsApp. Dá para sair quando quiser.'

const soDigitos = (v: string) => v.replace(/\D/g, '')

/** "(11) 98765-4321" → "11987654321"; aceita também com o 55 na frente. */
export function normalizarTelefone(v: string): string {
    const d = soDigitos(v)
    return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d
}

/** Envio da tela 05. A sacola vai só com identificadores: o preço é sempre do banco. */
export const esquemaEnvioPedido = z.object({
    chave: z.guid(),
    nome: z.string().trim().min(2, 'Informe seu nome').max(80),
    telefone: z
        .string()
        .transform(normalizarTelefone)
        .refine((t) => /^[1-9]{2}9\d{8}$/.test(t), 'WhatsApp inválido'),
    cep: z
        .string()
        .transform(soDigitos)
        .refine((c) => /^\d{8}$/.test(c), 'CEP inválido'),
    logradouro: z.string().trim().min(2, 'Informe a rua').max(120),
    numero: z.string().trim().min(1, 'Informe o número').max(20),
    complemento: z.string().trim().max(120),
    bairro: z.string().trim().max(80),
    cidade: z.string().trim().min(2, 'CEP sem cidade').max(80),
    uf: z.string().trim().regex(/^[A-Za-z]{2}$/, 'CEP sem estado'),
    ofertas: z.boolean(),
    /** Armadilha para robô: campo escondido que gente de verdade deixa vazio. */
    site: z.string().max(0),
    itens: z.array(esquemaItemSacola).min(1, 'Sacola vazia').max(30),
})

export type EnvioPedido = z.input<typeof esquemaEnvioPedido>

export type ResultadoEnvio = { ok: true; numero: number; link: string } | { ok: false; erro: string }
