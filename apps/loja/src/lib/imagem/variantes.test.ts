import { describe, expect, it } from 'vitest'
import { carregarFoto, larguraDaVariante, urlDaVariante } from './variantes'

const BASE = 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/'

describe('versão leve da foto (variantes/<largura>/<caminho>.webp)', () => {
    it('foto em pasta: mantém a pasta e o nome com extensão, e termina em .webp', () => {
        expect(urlDaVariante(`${BASE}doces-duas-irmas/geleia-de-amora-680g.jpg`, 800)).toBe(
            `${BASE}variantes/800/doces-duas-irmas/geleia-de-amora-680g.jpg.webp`,
        )
    })

    it('foto na raiz do bucket (as que o interno sobe)', () => {
        expect(urlDaVariante(`${BASE}3f2a.png`, 200)).toBe(`${BASE}variantes/200/3f2a.png.webp`)
    })

    it('fora do bucket de produtos (foto local, outro host): não tem versão leve', () => {
        expect(urlDaVariante('/combos/combo_black_familia.webp', 800)).toBeNull()
        expect(urlDaVariante('https://exemplo.com/products/a.jpg', 800)).toBeNull()
        expect(urlDaVariante(`${BASE.replace('products', 'outro')}a.jpg`, 800)).toBeNull()
    })

    it('já é uma versão leve: não gera variante de variante', () => {
        expect(urlDaVariante(`${BASE}variantes/800/a.jpg.webp`, 200)).toBeNull()
    })
})

describe('qual versão o loader usa', () => {
    it('miniatura até 256 px usa a de 200; acima, a de 800', () => {
        expect(larguraDaVariante(112)).toBe(200)
        expect(larguraDaVariante(256)).toBe(200)
        expect(larguraDaVariante(257)).toBe(800)
        expect(larguraDaVariante(1200)).toBe(800)
    })

    it('loader: foto do bucket vai para a versão leve; foto local fica como está', () => {
        expect(carregarFoto({ src: `${BASE}a.jpg`, width: 640 })).toBe(`${BASE}variantes/800/a.jpg.webp`)
        expect(carregarFoto({ src: `${BASE}a.jpg`, width: 200 })).toBe(`${BASE}variantes/200/a.jpg.webp`)
        expect(carregarFoto({ src: '/logo-mont-96.webp', width: 96 })).toBe('/logo-mont-96.webp?w=96')
    })
})
