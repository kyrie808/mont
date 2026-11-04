import { z } from 'zod'
import { esquemaAtribuicao } from '@/lib/medicao/origem'
import { esquemaItemSacola } from '@/lib/sacola/esquema'

/** Texto do aceite exatamente como aparece na tela 05 (guardado com o pedido — LGPD). */
export const TEXTO_OFERTAS = 'Quero receber ofertas da Mont no WhatsApp. Dá para sair quando quiser.'

const soDigitos = (v: string) => v.replace(/\D/g, '')

/** "(11) 98765-4321" → "11987654321"; aceita também com o 55 na frente. */
export function normalizarTelefone(v: string): string {
    const d = soDigitos(v)
    return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d
}

export const FORMAS_ENTREGA = ['entrega', 'retirada'] as const
export const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao'] as const
export type FormaEntrega = (typeof FORMAS_ENTREGA)[number]
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

/**
 * Envio da tela 05. A sacola vai só com identificadores: o preço é sempre do banco.
 * Retirada na Mont dispensa o endereço; na entrega, ele é obrigatório (mesmas mensagens de antes).
 */
export const esquemaEnvioPedido = z
    .object({
        chave: z.guid(),
        nome: z.string().trim().min(2, 'Informe seu nome').max(80),
        telefone: z
            .string()
            .transform(normalizarTelefone)
            .refine((t) => /^[1-9]{2}9\d{8}$/.test(t), 'WhatsApp inválido'),
        entrega: z.enum(FORMAS_ENTREGA),
        cep: z.string().transform(soDigitos),
        logradouro: z.string().trim().max(120),
        numero: z.string().trim().max(20),
        complemento: z.string().trim().max(120),
        bairro: z.string().trim().max(80),
        cidade: z.string().trim().max(80),
        uf: z.string().trim().max(2),
        /** Preferência do cliente; a forma que vale é a que o Gilmar escolhe ao confirmar. */
        pagamento: z.enum(FORMAS_PAGAMENTO),
        /** "Quem indicou a Mont para você?" (opcional, texto livre). */
        indicadoPor: z.string().trim().max(80),
        ofertas: z.boolean(),
        /** Armadilha para robô: campo escondido que gente de verdade deixa vazio. */
        site: z.string().max(0),
        itens: z.array(esquemaItemSacola).min(1, 'Sacola vazia').max(30),
        /** fbp/fbc/UTMs (cat_pedidos), para o Purchase da entrega sair ligado ao anúncio. Inválido = sem atribuição. */
        atribuicao: esquemaAtribuicao.optional().catch(undefined),
    })
    .superRefine((d, ctx) => {
        if (d.entrega !== 'entrega') return
        const exigir = (ok: boolean, campo: string, message: string) => {
            if (!ok) ctx.addIssue({ code: 'custom', path: [campo], message })
        }
        exigir(/^\d{8}$/.test(d.cep), 'cep', 'CEP inválido')
        exigir(d.logradouro.length >= 2, 'logradouro', 'Informe a rua')
        exigir(d.numero.length >= 1, 'numero', 'Informe o número')
        exigir(d.cidade.length >= 2, 'cidade', 'CEP sem cidade')
        exigir(/^[A-Za-z]{2}$/.test(d.uf), 'uf', 'CEP sem estado')
    })

export type EnvioPedido = z.input<typeof esquemaEnvioPedido>

export type ResultadoEnvio = { ok: true; numero: number; link: string } | { ok: false; erro: string }
