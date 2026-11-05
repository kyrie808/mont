import { reais } from '@/lib/formato'
import { catalogoDa, descreverCombo, resumirSacola } from '@/lib/sacola/calculo'
import type { ItemSacola } from '@/lib/sacola/esquema'
import { sacolaTemCartaoDiferente } from '@/lib/vitrine/cartao'
import type { Vitrine } from '@/lib/vitrine/tipos'
import type { FormaEntrega, FormaPagamento } from './esquema'

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
    entrega: FormaEntrega
    endereco: EnderecoMensagem
    /** Frete estimado pelo CEP; null = "a combinar". Só na entrega. */
    freteEstimado: number | null
    pagamento: FormaPagamento
    indicadoPor: string
    itens: ItemSacola[]
    vitrine: Vitrine
}

/** "Rua, número, complemento · Bairro, Cidade" (sem o que estiver vazio). */
export function enderecoEmUmaLinha(e: EnderecoMensagem): string {
    const rua = [e.logradouro, e.numero, e.complemento].map((x) => x.trim()).filter(Boolean).join(', ')
    const lugar = [e.bairro, e.cidade].map((x) => x.trim()).filter(Boolean).join(', ')
    return [rua, lugar].filter(Boolean).join(' · ')
}

const PAGAMENTO: Record<FormaPagamento, string> = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }

/**
 * Mensagem que o cliente manda para a Mont ao tocar em "Enviar pedido pelo WhatsApp".
 * Quem fala é o cliente. O total é o que o banco calculou (produtos no Pix, sem frete); o frete é
 * a estimativa pelo CEP, e o valor final é o que a Mont confirma. Texto base aprovado em 02/11.
 */
export function mensagemDoPedido(d: DadosMensagem): string {
    const { linhas } = resumirSacola(d.itens, catalogoDa(d.vitrine))
    const blocos = linhas.map((l) =>
        l.tipo === 'combo'
            ? `*${l.combo.nome}* — ${reais(l.subtotal)}\n${descreverCombo(l.combo, l.escolhas)}`
            : `${l.quantidade > 1 ? `${l.quantidade}× ` : ''}${l.produto.nome} — ${reais(l.subtotal)}`,
    )
    const retirada = d.entrega === 'retirada'
    const indicado = d.indicadoPor.trim()

    return [
        // Sem emoji: no computador, o redirecionamento do wa.me troca emoji fora do básico por "�".
        'Oi, Mont! Fiz um pedido pela loja.',
        '',
        `*Pedido nº ${d.numero}*`,
        '',
        blocos.join('\n\n'),
        '',
        !sacolaTemCartaoDiferente(linhas)
            ? `*Total dos produtos (Pix, dinheiro ou cartão): ${reais(d.total)}*`
            : d.pagamento === 'cartao'
              ? `*Total dos produtos no Pix: ${reais(d.total)}* (no cartão vale o preço do cartão)`
              : `*Total dos produtos (Pix ou dinheiro): ${reais(d.total)}*`,
        ...(retirada
            ? ['Dia e horário da retirada a gente combina por aqui.']
            : d.freteEstimado !== null
              ? [`Frete estimado pelo CEP: ${reais(d.freteEstimado)}`, 'Dia de entrega a gente combina por aqui.']
              : ['Frete e dia de entrega a gente combina por aqui.']),
        '',
        retirada ? '*Retirada na Mont*' : `*Entrega:* ${enderecoEmUmaLinha(d.endereco)}`,
        `*Pagamento:* ${PAGAMENTO[d.pagamento]}`,
        ...(indicado ? [`*Indicado por:* ${indicado}`] : []),
        `*Nome:* ${d.nome}`,
    ].join('\n')
}
