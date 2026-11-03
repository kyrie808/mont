import { describe, expect, it } from 'vitest'
import { atribuicaoDe, esquemaAtribuicao, interpretarOrigem, origemDaUrl, VALIDADE_ORIGEM_MS } from './origem'

const AGORA = 1_762_170_000_000
const FBP = 'fb.1.1762169000000.1234567890'
const FBC = 'fb.1.1762169000000.IwAR2xYz_ab-CD'

describe('origemDaUrl', () => {
    it('guarda UTMs e fbclid da entrada', () => {
        expect(origemDaUrl('?utm_source=facebook&utm_campaign=black&fbclid=IwAR2xYz_ab-CD&x=1', AGORA)).toEqual({
            utm_source: 'facebook',
            utm_campaign: 'black',
            fbclid: 'IwAR2xYz_ab-CD',
            em: AGORA,
        })
    })

    it('URL sem campanha não apaga a origem guardada (devolve null)', () => {
        expect(origemDaUrl('', AGORA)).toBeNull()
        expect(origemDaUrl('?editar=abc', AGORA)).toBeNull()
    })

    it('fbclid com caractere estranho é descartado; UTM longa é cortada em 200', () => {
        const origem = origemDaUrl(`?fbclid=<script>&utm_term=${'x'.repeat(300)}`, AGORA)
        expect(origem?.fbclid).toBeUndefined()
        expect(origem?.utm_term).toHaveLength(200)
    })
})

describe('interpretarOrigem', () => {
    it('vale por 7 dias', () => {
        const guardada = JSON.stringify({ utm_source: 'facebook', em: AGORA })
        expect(interpretarOrigem(guardada, AGORA + VALIDADE_ORIGEM_MS)?.utm_source).toBe('facebook')
        expect(interpretarOrigem(guardada, AGORA + VALIDADE_ORIGEM_MS + 1)).toBeNull()
    })

    it('lixo no armazenamento vira null', () => {
        expect(interpretarOrigem('{nada', AGORA)).toBeNull()
        expect(interpretarOrigem(null, AGORA)).toBeNull()
    })
})

describe('atribuicaoDe', () => {
    it('usa os cookies do pixel quando existem', () => {
        const a = atribuicaoDe(`_ga=1; _fbp=${FBP}; _fbc=${FBC}`, { fbclid: 'outro', utm_source: 'facebook', em: AGORA })
        expect(a).toEqual({ fbp: FBP, fbc: FBC, utm_source: 'facebook' })
    })

    it('sem _fbc, monta do fbclid guardado com o instante da chegada', () => {
        expect(atribuicaoDe('', { fbclid: 'IwAR2xYz', em: AGORA })).toEqual({ fbc: `fb.1.${AGORA}.IwAR2xYz` })
    })

    it('cookie fora do formato é ignorado', () => {
        expect(atribuicaoDe('_fbp=qualquer; _fbc=fb.1.x.y', null)).toEqual({})
    })

    it('o que sai daqui passa no esquema do servidor', () => {
        const a = atribuicaoDe(`_fbp=${FBP}`, { fbclid: 'IwAR2xYz', utm_medium: 'paid', em: AGORA })
        expect(esquemaAtribuicao.safeParse(a).success).toBe(true)
    })
})
