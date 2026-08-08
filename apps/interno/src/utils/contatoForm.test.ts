import { describe, it, expect } from 'vitest'
import { mesclarValoresContato } from './contatoForm'

/**
 * REGRESSÃO — bug de produção 01/08/2026.
 *
 * `ContatoFormModal.onSubmit` fazia `{ ...data, ...rawValues }`: o `data` vinha
 * do Zod com o telefone já normalizado pelo `.transform(cleanPhone)`, e o
 * `getValues()` cru era espalhado POR CIMA, restaurando o texto digitado.
 * Resultado: "Beth Mergulhão" foi salva como '11 96979-1012' e virou um segundo
 * cadastro da "Maria Elisabete Mergulhao" (já salva como '11969791012').
 */
describe('mesclarValoresContato', () => {
    it('NÃO deixa o valor cru sobrescrever o telefone normalizado pelo Zod', () => {
        const parsed = { nome: 'Beth Mergulhão', telefone: '11969791012' }
        const raw = { nome: 'Beth Mergulhão', telefone: '11 96979-1012' }

        expect(mesclarValoresContato(parsed, raw).telefone).toBe('11969791012')
    })

    it('preserva campos que só existem no estado cru do formulário', () => {
        // Motivo original do getValues(): campos preenchidos por setValue (ViaCEP).
        const parsed = { nome: 'Ana', telefone: '11999998888' }
        const raw = { nome: 'Ana', telefone: '11999998888', logradouro: 'Rua Roberto Rohe', cidade: 'São Paulo' }

        const out = mesclarValoresContato(parsed, raw)
        expect(out.logradouro).toBe('Rua Roberto Rohe')
        expect(out.cidade).toBe('São Paulo')
    })

    it('o parseado vence em qualquer campo que os dois tenham', () => {
        const parsed = { nome: 'Ana Paula', telefone: '11999998888', cep: '03289040' }
        const raw = { nome: 'ana paula', telefone: '(11) 99999-8888', cep: '03289-040' }

        const out = mesclarValoresContato(parsed, raw)
        expect(out.nome).toBe('Ana Paula')
        expect(out.cep).toBe('03289040')
    })
})
