import { describe, expect, it } from 'vitest'
import { interpretarAvisos, mensagemAviso, separarEsgotados } from './esgotado'

const item = (id: string, disponivel: boolean) => ({ id, disponivel })

describe('esgotados no fim da seção', () => {
    it('à venda primeiro, esgotados depois, cada grupo na ordem da seção', () => {
        const { aVenda, esgotados } = separarEsgotados([
            item('a', true),
            item('x', false),
            item('b', true),
            item('y', false),
            item('c', true),
        ])
        expect(aVenda.map((p) => p.id)).toEqual(['a', 'b', 'c'])
        expect(esgotados.map((p) => p.id)).toEqual(['x', 'y'])
    })

    it('seção sem esgotado: nada no grupo de esgotados (o divisor não aparece)', () => {
        expect(separarEsgotados([item('a', true), item('b', true)]).esgotados).toEqual([])
    })
})

describe('mensagem do "Me avisa quando chegar"', () => {
    it('usa o nome do produto como está na loja', () => {
        expect(mensagemAviso('Doce de Abóbora com Coco 680g')).toBe(
            'Oi! Pode me avisar quando chegar mais Doce de Abóbora com Coco 680g?',
        )
    })
})

describe('avisos guardados no aparelho', () => {
    it('lê a lista de ids', () => {
        expect(interpretarAvisos('["p1","p2"]')).toEqual(['p1', 'p2'])
    })

    it('nada guardado, JSON quebrado ou formato estranho: lista vazia', () => {
        expect(interpretarAvisos(null)).toEqual([])
        expect(interpretarAvisos('{quebrado')).toEqual([])
        expect(interpretarAvisos('{"p1":true}')).toEqual([])
        expect(interpretarAvisos('"p1"')).toEqual([])
    })

    it('ignora o que não é texto dentro da lista', () => {
        expect(interpretarAvisos('["p1",2,null,"p2"]')).toEqual(['p1', 'p2'])
    })
})
