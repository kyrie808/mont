import { describe, it, expect } from 'vitest'
import { resolverTermo, type ProdutoVendavel, type Resolucao } from '@mont/shared'

// Catálogo real da Mont em 28/09/2026. Os apelidos são os sinônimos curados.
// `ProdutoVendavel` (não `ProdutoCatalogo`): esse último já existe em @mont/shared
// como a view pública do catálogo (vw_catalogo_produtos, usada em apps/catalogo) — mesmo
// nome colidiria e quebraria o typecheck do catálogo público. Ver comentário em index.ts.
const CATALOGO: ProdutoVendavel[] = [
    { id: 'pq-1k-25', nome: 'Pão de Queijo 1kg - 25gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: -103 },
    { id: 'pq-1k-100', nome: 'Pão de Queijo 1kg - 100gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: 4 },
    { id: 'pq-2k-50', nome: 'Pão de Queijo 2kg - 50gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 60, estoqueAtual: -27 },
    { id: 'chipa-1k', nome: 'Chipa 1kg', apelido: 'chipa, chipinha', preco: 40, estoqueAtual: -243 },
    { id: 'chipa-2k', nome: 'Chipa 2kg', apelido: 'chipa, chipinha', preco: 80, estoqueAtual: -21 },
    { id: 'palito-1k', nome: 'Palito de Queijo 1kg', apelido: 'palito, palito de queijo', preco: 40, estoqueAtual: -426 },
    { id: 'palito-2k', nome: 'Palito de Queijo 2kg', apelido: 'palito, palito de queijo', preco: 80, estoqueAtual: -30 },
    { id: 'massa-1k', nome: 'Massa Pão de Queijo 1kg', apelido: 'baldinho, massa, massa crua, resfriado', preco: 30, estoqueAtual: -323 },
    { id: 'massa-4k', nome: 'Massa Pão de Queijo 4kg', apelido: 'balde, baldão, massa, resfriado', preco: 75, estoqueAtual: -228 },
]

describe('resolverTermo', () => {
    // `expect()` nao estreita tipo para o TypeScript: acessar `r.opcoes` direto num union
    // que inclui `resolvido` nao compila. Este helper estreita e falha com mensagem util.
    function opcoesDe(r: Resolucao, tipo: 'ambiguo' | 'nao_encontrado'): string[] {
        if (r.tipo !== tipo) throw new Error(`esperava ${tipo}, veio ${r.tipo}`)
        return r.opcoes.map((p) => p.id).sort()
    }

    it('peso que a família não tem → nao_encontrado com as opções DELA', () => {
        // O defeito de 26/09: ela anotou "500 g de chipa", que não existe.
        const r = resolverTermo('500g de chipa', CATALOGO)
        expect(opcoesDe(r, 'nao_encontrado')).toEqual(['chipa-1k', 'chipa-2k'])
    })

    it('família + peso com mais de um tamanho → ambiguo', () => {
        const r = resolverTermo('1 kg de pão de queijo', CATALOGO)
        expect(opcoesDe(r, 'ambiguo')).toEqual(['pq-1k-100', 'pq-1k-25'])
    })

    it('família + peso com um tamanho só → resolvido', () => {
        const r = resolverTermo('2 kg de pão de queijo', CATALOGO)
        expect(r.tipo).toBe('resolvido')
        expect(r).toMatchObject({ produto: { id: 'pq-2k-50' } })
    })

    it('sinônimo resolve sozinho quando a família tem um peso só naquele nome', () => {
        const r = resolverTermo('baldinho', CATALOGO)
        expect(r.tipo).toBe('resolvido')
        expect(r).toMatchObject({ produto: { id: 'massa-1k' } })
    })

    it('família sem peso → ambiguo com os pesos', () => {
        expect(opcoesDe(resolverTermo('chipa', CATALOGO), 'ambiguo')).toEqual(['chipa-1k', 'chipa-2k'])
    })

    it('"pão de queijo" NÃO traz a massa crua', () => {
        // Substring pegaria os 5 (inclui "Massa Pão de Queijo"). A curadoria evita
        // ela perguntar "pronto ou cru?" numa conversa em que ele quis o pronto.
        const r = resolverTermo('pão de queijo', CATALOGO)
        const ids = r.tipo === 'resolvido' ? [r.produto.id] : r.opcoes.map((p) => p.id)
        expect(ids).not.toContain('massa-1k')
        expect(ids).not.toContain('massa-4k')
    })

    it('ignora acento e caixa', () => {
        expect(resolverTermo('PAO DE QUEIJO 2kg', CATALOGO).tipo).toBe('resolvido')
    })

    it('sinônimo casa como palavra inteira, não como pedaço', () => {
        // "baldinho" contém "balde". Busca por substring devolveria os dois baldes.
        const r = resolverTermo('baldinho', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'massa-1k' } })
    })

    it('peso da UNIDADE também resolve, não só o da embalagem', () => {
        // "me vê o de 100g" fala do tamanho do pão, não do pacote — e existe.
        const r = resolverTermo('pão de queijo de 100g', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'pq-1k-100' } })
    })

    it('pontuação não atrapalha — cliente escreve com "!" e ","', () => {
        const r = resolverTermo('me vê 2kg de pão de queijo, por favor!', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'pq-2k-50' } })
    })

    it('KG maiúsculo também é peso', () => {
        expect(resolverTermo('2KG de chipa', CATALOGO)).toMatchObject({
            tipo: 'resolvido', produto: { id: 'chipa-2k' },
        })
    })

    it('termo que não é produto nenhum → nao_encontrado sem opções', () => {
        expect(opcoesDe(resolverTermo('coxinha', CATALOGO), 'nao_encontrado')).toEqual([])
    })

    it('catálogo vazio → nao_encontrado, nunca explode', () => {
        expect(resolverTermo('chipa', []).tipo).toBe('nao_encontrado')
    })
})
