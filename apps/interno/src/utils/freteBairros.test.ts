import { describe, expect, it } from 'vitest'
import { prepararBairrosFixos } from './freteBairros'

describe('prepararBairrosFixos (aba Frete)', () => {
    it('limpa espaços e arredonda o valor', () => {
        expect(prepararBairrosFixos([{ bairro: '  Vila   Nova ', cidade: ' São Paulo ', valor: 15.004 }])).toEqual({
            ok: true,
            bairros: [{ bairro: 'Vila Nova', cidade: 'São Paulo', valor: 15 }],
        })
    })

    it('recusa bairro ou cidade vazios e valor zero', () => {
        expect(prepararBairrosFixos([{ bairro: '', cidade: 'São Paulo', valor: 15 }]).ok).toBe(false)
        expect(prepararBairrosFixos([{ bairro: 'Interlagos', cidade: ' ', valor: 15 }]).ok).toBe(false)
        expect(prepararBairrosFixos([{ bairro: 'Interlagos', cidade: 'São Paulo', valor: 0 }])).toEqual({
            ok: false,
            erro: 'Informe o valor do frete de Interlagos',
        })
    })

    it('o mesmo bairro duas vezes (sem acento ou maiúscula) é repetido', () => {
        const r = prepararBairrosFixos([
            { bairro: 'Vila Nova', cidade: 'São Paulo', valor: 15 },
            { bairro: 'VILA NOVA', cidade: 'sao paulo', valor: 10 },
        ])
        expect(r).toEqual({ ok: false, erro: 'VILA NOVA (sao paulo) está duas vezes' })
    })

    it('mesmo bairro em outra cidade pode', () => {
        expect(
            prepararBairrosFixos([
                { bairro: 'Vila Nova', cidade: 'São Paulo', valor: 15 },
                { bairro: 'Vila Nova', cidade: 'Mauá', valor: 5 },
            ]).ok,
        ).toBe(true)
    })

    it('lista vazia grava vazia', () => {
        expect(prepararBairrosFixos([])).toEqual({ ok: true, bairros: [] })
    })
})
