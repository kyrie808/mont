import { describe, expect, it } from 'vitest'
import { DESCRICAO_LOJA, descricaoDoProduto, metadadosDaPagina } from './seo'

describe('prévia do link', () => {
    it('frase = subtítulo; sem ele, a 1ª linha da descrição; sem nada, a frase da loja', () => {
        expect(descricaoDoProduto({ subtitulo: ' Rende 50 pães ', descricao: 'Outra coisa' })).toBe('Rende 50 pães')
        expect(descricaoDoProduto({ subtitulo: null, descricao: '\n  Massa com Canastra.\nSegunda linha' })).toBe('Massa com Canastra.')
        expect(descricaoDoProduto({ subtitulo: '', descricao: null })).toBe(DESCRICAO_LOJA)
    })

    it('canônico no domínio final; foto do produto na prévia, a imagem da loja sem foto', () => {
        const com = metadadosDaPagina('/produto/balde', 'Balde', 'x', 'https://exemplo/capa.webp')
        expect(com.alternates?.canonical).toBe('https://www.montdistribuidora.com.br/produto/balde')
        expect(com.openGraph?.images).toEqual([{ url: 'https://exemplo/capa.webp', alt: 'Balde' }])
        const sem = metadadosDaPagina('/', 'Loja', 'x', null)
        expect(sem.openGraph?.images).toEqual([expect.objectContaining({ url: '/logo-mont.png' })])
    })
})
