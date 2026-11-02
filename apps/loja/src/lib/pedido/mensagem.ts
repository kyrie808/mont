import { reais } from '@/lib/formato'
import { catalogoDa, descreverCombo, resumirSacola } from '@/lib/sacola/calculo'
import type { ItemSacola } from '@/lib/sacola/esquema'
import type { Vitrine } from '@/lib/vitrine/tipos'

interface DadosMensagem {
    numero: number
    total: number
    nome: string
    endereco: string
    itens: ItemSacola[]
    vitrine: Vitrine
}

/**
 * Mensagem que o cliente manda para a Mont ao tocar em "Enviar pedido pelo WhatsApp".
 * Quem fala é o cliente. O total é o que o banco calculou (sem frete).
 * TEXTO AGUARDANDO OK DO LUCCAS antes de publicar.
 */
export function mensagemDoPedido({ numero, total, nome, endereco, itens, vitrine }: DadosMensagem): string {
    const { linhas } = resumirSacola(itens, catalogoDa(vitrine))
    const blocos = linhas.map((l) =>
        l.tipo === 'combo'
            ? `*${l.combo.nome}* — ${reais(l.subtotal)}\n${descreverCombo(l.combo, l.escolhas)}`
            : `${l.quantidade > 1 ? `${l.quantidade}× ` : ''}${l.produto.nome} — ${reais(l.subtotal)}`,
    )

    return [
        'Olá, Mont! Acabei de fazer um pedido na loja.',
        '',
        `*Pedido nº ${numero}*`,
        '',
        blocos.join('\n\n'),
        '',
        `*Total dos produtos no Pix: ${reais(total)}*`,
        'Frete e dia de entrega: combinamos por aqui.',
        '',
        `*Entrega:* ${endereco}`,
        `*Nome:* ${nome}`,
    ].join('\n')
}
