import { describe, expect, it } from 'vitest'
import type { ItemSacola } from '@/lib/sacola/esquema'
import type { ProdutoLoja, Vitrine } from '@/lib/vitrine/tipos'
import { mensagemDoPedido } from './mensagem'

const vitrine: Vitrine = { campanha: null, hero: null, combos: [], secoes: [] }
const base = {
    numero: 81,
    total: 75,
    nome: 'Maria Souza',
    entrega: 'entrega' as const,
    endereco: { logradouro: 'Rua Nova', numero: '50', complemento: '', bairro: 'Rudge Ramos', cidade: 'São Bernardo do Campo' },
    freteEstimado: 5 as number | null,
    pagamento: 'pix' as const,
    indicadoPor: '',
    itens: [],
    vitrine,
}

describe('mensagemDoPedido (Parte F)', () => {
    it('entrega com frete estimado, pagamento e endereço', () => {
        const m = mensagemDoPedido(base)
        // reais() usa o espaço fixo do Intl entre "R$" e o número.
        expect(m).toMatch(/Frete estimado pelo CEP: R\$\s5\n/)
        expect(m).toContain('Dia de entrega a gente combina por aqui.')
        expect(m).toContain('*Entrega:* Rua Nova, 50 · Rudge Ramos, São Bernardo do Campo')
        expect(m).toContain('*Pagamento:* Pix')
        expect(m).not.toContain('Indicado por')
    })

    it('frete a combinar', () => {
        expect(mensagemDoPedido({ ...base, freteEstimado: null })).toContain('Frete e dia de entrega a gente combina por aqui.')
    })

    it('retirada: sem endereço e sem frete', () => {
        const m = mensagemDoPedido({ ...base, entrega: 'retirada' })
        expect(m).toContain('*Retirada na Mont*')
        expect(m).toContain('Dia e horário da retirada a gente combina por aqui.')
        expect(m).not.toMatch(/Frete|\*Entrega:\*/)
    })

    it('cartão no mesmo preço do Pix (05/11/2026): total vale para Pix, dinheiro ou cartão; indicado por aparece quando preenchido', () => {
        const m = mensagemDoPedido({ ...base, pagamento: 'cartao', indicadoPor: '  Ana ' })
        expect(m).toMatch(/\*Total dos produtos \(Pix, dinheiro ou cartão\): R\$\s75\*/)
        expect(m).not.toContain('preço do cartão')
        expect(m).toContain('*Pagamento:* Cartão')
        expect(m).toContain('*Indicado por:* Ana')
    })

    it('se o cartão voltar a ter outro preço, o aviso do cartão volta', () => {
        const balde: ProdutoLoja = {
            id: 'balde', slug: 'balde', nome: 'Balde 4 kg', subtitulo: null, descricao: null, imagemUrl: null, fotos: [],
            categoria: null, selo: null, beneficios: [], preparo: [], preco: 65, precoDe: 75, precoCredito: 68, disponivel: true,
        }
        const comBalde: Vitrine = {
            campanha: { nome: 'Black', fim: '2026-11-30T23:59:59-03:00' }, hero: null, combos: [],
            secoes: [{ id: 's', nome: 'Massas', descricao: null, formato: 'cartoes', itens: [balde] }],
        }
        const itens: ItemSacola[] = [{ tipo: 'produto', produtoId: 'balde', quantidade: 1 }]
        const noCartao = mensagemDoPedido({ ...base, total: 65, vitrine: comBalde, itens, pagamento: 'cartao' })
        expect(noCartao).toContain('(no cartão vale o preço do cartão)')
        const noPix = mensagemDoPedido({ ...base, total: 65, vitrine: comBalde, itens, pagamento: 'pix' })
        expect(noPix).toContain('*Total dos produtos (Pix ou dinheiro):')
    })
})
