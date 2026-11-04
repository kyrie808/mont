import { describe, expect, it } from 'vitest'
import type { Vitrine } from '@/lib/vitrine/tipos'
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

    it('cartão avisa o preço do cartão; indicado por aparece quando preenchido', () => {
        const m = mensagemDoPedido({ ...base, pagamento: 'cartao', indicadoPor: '  Ana ' })
        expect(m).toContain('(no cartão vale o preço do cartão)')
        expect(m).toContain('*Pagamento:* Cartão')
        expect(m).toContain('*Indicado por:* Ana')
    })
})
