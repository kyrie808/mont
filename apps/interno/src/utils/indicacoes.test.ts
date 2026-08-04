import { describe, it, expect } from 'vitest'
import type { Contato, Venda } from '@mont/shared'
import { calcularEstatisticasIndicacao } from './calculations'

/**
 * Regressão: "indicação convertida" era lida da COLUNA `contatos.status`, que é
 * carimbada no cadastro e nunca acompanha o comportamento. Na produção isso dava
 * 83 de 83 indicados convertidos (100%) contra 79 reais — e a recompensa do
 * embaixador (R$5 por conversão) é calculada em cima disso.
 * Conversão de verdade = comprou, ou seja, tem venda ENTREGUE não-brinde.
 */

const INDICADOR = 'ind-1'

function contato(id: string, status: string): Contato {
    return { id, nome: id, status, indicado_por_id: INDICADOR } as unknown as Contato
}

function venda(contatoId: string, extras: Partial<Venda> = {}): Venda {
    return {
        id: `v-${contatoId}`,
        contato_id: contatoId,
        total: 100,
        status: 'entregue',
        forma_pagamento: 'venda',
        ...extras,
    } as unknown as Venda
}

describe('calcularEstatisticasIndicacao — conversão vem da compra, não da coluna', () => {
    it('indicado marcado "cliente" sem nenhuma compra NÃO conta como convertido', () => {
        const r = calcularEstatisticasIndicacao(INDICADOR, [contato('a', 'cliente')], [])

        expect(r.totalIndicacoes).toBe(1)
        expect(r.indicacoesConvertidas).toBe(0)
        expect(r.totalComprasIndicados).toBe(0)
    })

    it('indicado marcado "lead" que já comprou CONTA como convertido', () => {
        const r = calcularEstatisticasIndicacao(
            INDICADOR,
            [contato('a', 'lead')],
            [venda('a')],
        )

        expect(r.indicacoesConvertidas).toBe(1)
        expect(r.totalComprasIndicados).toBe(100)
    })

    it('venda pendente ainda não converte (o produto não saiu)', () => {
        const r = calcularEstatisticasIndicacao(
            INDICADOR,
            [contato('a', 'cliente')],
            [venda('a', { status: 'pendente' } as Partial<Venda>)],
        )

        expect(r.indicacoesConvertidas).toBe(0)
    })

    it('brinde não converte — receber de graça não é comprar', () => {
        const r = calcularEstatisticasIndicacao(
            INDICADOR,
            [contato('a', 'cliente')],
            [venda('a', { forma_pagamento: 'brinde' } as Partial<Venda>)],
        )

        expect(r.indicacoesConvertidas).toBe(0)
        expect(r.totalComprasIndicados).toBe(0)
    })

    it('conta cada indicado uma vez, mesmo com várias compras', () => {
        const r = calcularEstatisticasIndicacao(
            INDICADOR,
            [contato('a', 'lead'), contato('b', 'cliente')],
            [venda('a'), { ...venda('a'), id: 'v-a2' }, venda('b')],
        )

        expect(r.totalIndicacoes).toBe(2)
        expect(r.indicacoesConvertidas).toBe(2)
        expect(r.totalComprasIndicados).toBe(300)
    })

    it('ignora quem foi indicado por outra pessoa', () => {
        const outro = { ...contato('z', 'cliente'), indicado_por_id: 'ind-2' } as Contato
        const r = calcularEstatisticasIndicacao(INDICADOR, [contato('a', 'lead'), outro], [venda('a'), venda('z')])

        expect(r.totalIndicacoes).toBe(1)
        expect(r.indicacoesConvertidas).toBe(1)
        expect(r.totalComprasIndicados).toBe(100)
    })
})
