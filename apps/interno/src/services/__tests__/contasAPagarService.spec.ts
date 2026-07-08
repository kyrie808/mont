import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regressão do bug: updateContaAPagar escrevia em `saldo_devedor`, que é coluna
 * GENERATED ALWAYS AS (valor_total - valor_pago) STORED em produção. Qualquer UPDATE
 * incluindo esse campo levanta Postgres 428C9 → editar o valor de uma despesa sem
 * pagamento estava quebrado.
 *
 * Camada unit (jsdom, sem banco): mockamos o supabase client e verificamos o PAYLOAD
 * que o service constrói. O defeito está na construção do payload — o DB está correto
 * ao rejeitar a escrita na coluna gerada. Este teste FALHA antes do fix (payload contém
 * saldo_devedor) e passa depois (a coluna gerada deriva sozinha).
 */

const updateSpy = vi.fn()

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            update: (payload: unknown) => {
                updateSpy(payload)
                return { eq: () => Promise.resolve({ error: null }) }
            },
        }),
    },
}))

import { contasAPagarService } from '../contasAPagarService'

describe('contasAPagarService.updateContaAPagar — não escreve em coluna gerada saldo_devedor', () => {
    beforeEach(() => {
        updateSpy.mockClear()
    })

    it('inclui valor_total mas NÃO inclui saldo_devedor no payload (coluna é GENERATED ALWAYS)', async () => {
        await contasAPagarService.updateContaAPagar('id-1', { valor_total: 150 })

        expect(updateSpy).toHaveBeenCalledTimes(1)
        const payload = updateSpy.mock.calls[0][0] as Record<string, unknown>
        expect(payload).toMatchObject({ valor_total: 150 })
        expect(payload).not.toHaveProperty('saldo_devedor')
    })

    it('edições de metadados (sem valor) também não tocam saldo_devedor', async () => {
        await contasAPagarService.updateContaAPagar('id-2', { credor: 'Novo Credor', descricao: 'Luz' })

        const payload = updateSpy.mock.calls[0][0] as Record<string, unknown>
        expect(payload).toMatchObject({ credor: 'Novo Credor', descricao: 'Luz' })
        expect(payload).not.toHaveProperty('saldo_devedor')
    })
})
