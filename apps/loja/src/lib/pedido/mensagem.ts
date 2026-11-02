import { reais } from '@/lib/formato'
import { catalogoDa, descreverCombo, resumirSacola } from '@/lib/sacola/calculo'
import type { ItemSacola } from '@/lib/sacola/esquema'
import type { Vitrine } from '@/lib/vitrine/tipos'

interface EnderecoMensagem {
    logradouro: string
    numero: string
    complemento: string
    bairro: string
    cidade: string
}

interface DadosMensagem {
    numero: number
    total: number
    nome: string
    endereco: EnderecoMensagem
    itens: ItemSacola[]
    vitrine: Vitrine
}

/** "Rua, número, complemento · Bairro, Cidade" (sem o que estiver vazio). */
export function enderecoEmUmaLinha(e: EnderecoMensagem): string {
    const rua = [e.logradouro, e.numero, e.complemento].map((x) => x.trim()).filter(Boolean).join(', ')
    const lugar = [e.bairro, e.cidade].map((x) => x.trim()).filter(Boolean).join(', ')
    return [rua, lugar].filter(Boolean).join(' · ')
}

/**
 * Mensagem que o cliente manda para a Mont ao tocar em "Enviar pedido pelo WhatsApp".
 * Quem fala é o cliente. O total é o que o banco calculou (sem frete). Texto aprovado pelo Luccas em 02/11.
 */
export function mensagemDoPedido({ numero, total, nome, endereco, itens, vitrine }: DadosMensagem): string {
    const { linhas } = resumirSacola(itens, catalogoDa(vitrine))
    const blocos = linhas.map((l) =>
        l.tipo === 'combo'
            ? `*${l.combo.nome}* — ${reais(l.subtotal)}\n${descreverCombo(l.combo, l.escolhas)}`
            : `${l.quantidade > 1 ? `${l.quantidade}× ` : ''}${l.produto.nome} — ${reais(l.subtotal)}`,
    )

    return [
        'Oi, Mont! Fiz um pedido pela loja 🧀',
        '',
        `*Pedido nº ${numero}*`,
        '',
        blocos.join('\n\n'),
        '',
        `*Total dos produtos (Pix ou dinheiro): ${reais(total)}*`,
        'Frete, dia de entrega e pagamento a gente combina por aqui.',
        '',
        `*Entrega:* ${enderecoEmUmaLinha(endereco)}`,
        `*Nome:* ${nome}`,
    ].join('\n')
}
