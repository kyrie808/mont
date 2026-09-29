import { describe, it, expect } from 'vitest'
import { resolverTermo, renderizarPedido, totalPedido, type ProdutoVendavel, type Resolucao, type ItemPedido } from '@mont/shared'

// Catálogo real da Mont em 29/09/2026, depois da primeira contagem física de estoque.
// Os apelidos são os sinônimos curados; `estoqueAtual` são os números contados.
//
// ⚠️ Este fixture espelha a produção de propósito — é ele que documenta quais perguntas a
// agente faz. Produto que entra ou sai do catálogo MUDA a ambiguidade: quando o
// `2kg - 100gr` voltou a ser vendido, "2 kg de pão de queijo" deixou de resolver sozinho.
// `ProdutoVendavel` (não `ProdutoCatalogo`): esse último já existe em @mont/shared
// como a view pública do catálogo (vw_catalogo_produtos, usada em apps/catalogo) — mesmo
// nome colidiria e quebraria o typecheck do catálogo público. Ver comentário em index.ts.
const CATALOGO: ProdutoVendavel[] = [
    { id: 'pq-1k-25', nome: 'Pão de Queijo 1kg - 25gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: -103 },
    { id: 'pq-1k-100', nome: 'Pão de Queijo 1kg - 100gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 30, estoqueAtual: 4 },
    { id: 'pq-2k-50', nome: 'Pão de Queijo 2kg - 50gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 60, estoqueAtual: 17 },
    { id: 'pq-2k-100', nome: 'Pão de Queijo 2kg - 100gr', apelido: 'pão de queijo, pao de queijo, pdq, congelado', preco: 60, estoqueAtual: 9 },
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
        // Chipa tem 1kg e 2kg e nenhum tamanho de unidade, então o peso decide sozinho.
        const r = resolverTermo('2 kg de chipa', CATALOGO)
        expect(r.tipo).toBe('resolvido')
        expect(r).toMatchObject({ produto: { id: 'chipa-2k' } })
    })

    it('mesma embalagem com tamanhos diferentes → ambiguo, ela pergunta a grama', () => {
        // Enquanto só existia o de 50g, isto resolvia sozinho. O 2kg-100gr voltou a ser
        // vendido em 29/09 e a pergunta nasceu junto — é o comportamento correto.
        const r = resolverTermo('2 kg de pão de queijo', CATALOGO)
        expect(opcoesDe(r, 'ambiguo')).toEqual(['pq-2k-100', 'pq-2k-50'])
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
        expect(resolverTermo('2 KG DE CHIPA', CATALOGO)).toMatchObject({
            tipo: 'resolvido', produto: { id: 'chipa-2k' },
        })
        // E o acento no sinônimo curado também casa sem acento no termo do cliente.
        expect(opcoesDe(resolverTermo('PAO DE QUEIJO 2kg', CATALOGO), 'ambiguo'))
            .toEqual(['pq-2k-100', 'pq-2k-50'])
    })

    it('sinônimo casa como palavra inteira, não como pedaço', () => {
        // "baldinho" contém "balde". Busca por substring devolveria os dois baldes.
        const r = resolverTermo('baldinho', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'massa-1k' } })
    })

    it('peso da UNIDADE também é procurado, não só o da embalagem', () => {
        // "me vê o de 100g" fala do tamanho do pão, não do pacote. Antes de 29/09 isto
        // resolvia sozinho; com o 2kg-100gr de volta, existem dois pães de 100g e ela
        // pergunta o tamanho do pacote. O que importa aqui é que a busca por unidade
        // ACONTECE — sem ela, a resposta seria "a Mont não vende isso".
        const r = resolverTermo('pão de queijo de 100g', CATALOGO)
        expect(opcoesDe(r, 'ambiguo')).toEqual(['pq-1k-100', 'pq-2k-100'])
    })

    it('pontuação não atrapalha — cliente escreve com "!" e ","', () => {
        const r = resolverTermo('me vê 2kg de chipa, por favor!', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'chipa-2k' } })
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

    it('termo cita dois produtos distintos → ambiguo, não descarta um deles calado', () => {
        // "chipa e massa de 4kg" casa "chipa" num produto e "massa" noutro. Resolver
        // direto pelo peso ("4kg") devolveria só a massa e a chipa sumiria em silêncio.
        const r = resolverTermo('chipa e massa de 4kg', CATALOGO)
        expect(opcoesDe(r, 'ambiguo')).toEqual(['chipa-1k', 'chipa-2k', 'massa-1k', 'massa-4k'])
    })

    it('não regressão: mesma família casando pelo MESMO sinônimo continua resolvendo por peso', () => {
        // "massa" casa massa-1k e massa-4k pelo sinônimo IDÊNTICO — não é "dois produtos
        // citados juntos", é um produto só com variação de peso. Tem que resolver normal.
        const r = resolverTermo('massa de 4kg', CATALOGO)
        expect(r).toMatchObject({ tipo: 'resolvido', produto: { id: 'massa-4k' } })
    })

    it('peso decimal no NOME do produto não é corrompido pela normalização', () => {
        // `pesosDoNome` não pode normalizar "2,5kg": a vírgula viraria espaço e o regex
        // casaria só o "5kg" final, lendo a embalagem como 5000g em vez de 2500g — e aí
        // um cliente pedindo 5kg receberia silenciosamente o produto de 2,5kg como
        // resolvido. O catálogo real da Mont não tem peso decimal hoje, por isso o
        // catálogo sintético aqui, isolado dos outros testes.
        const catalogoDecimal: ProdutoVendavel[] = [
            { id: 'chipa-2_5k', nome: 'Chipa 2,5kg', apelido: 'chipa', preco: 100, estoqueAtual: 0 },
        ]
        expect(resolverTermo('chipa de 2,5kg', catalogoDecimal)).toMatchObject({
            tipo: 'resolvido', produto: { id: 'chipa-2_5k' },
        })
        expect(resolverTermo('chipa de 5kg', catalogoDecimal).tipo).not.toBe('resolvido')
    })
})

describe('renderizarPedido', () => {
    const itens: ItemPedido[] = [
        { produtoId: 'pq-1k-100', nome: 'Pão de Queijo 1kg - 100gr', quantidade: 1, precoUnitario: 30, semEstoque: false },
        { produtoId: 'chipa-1k', nome: 'Chipa 1kg', quantidade: 2, precoUnitario: 40, semEstoque: true },
    ]

    it('lista item, quantidade e subtotal', () => {
        const txt = renderizarPedido(itens)
        // Afirmar linha inteira: nome + quantidade + subtotal pareados. Um bug que trocasse
        // os subtotais entre linhas passaria em `toContain` solto mas falharia aqui.
        expect(txt).toContain('1× Pão de Queijo 1kg - 100gr — R$ 30,00')
        expect(txt).toContain('2× Chipa 1kg — R$ 80,00 ⚠️ sem estoque no sistema')
    })

    it('marca o que está sem estoque — a equipe confere antes de separar', () => {
        const txt = renderizarPedido(itens)
        // Afirmar que o alerta caiu na Chipa (semEstoque: true) e não no pão de queijo.
        expect(txt).toContain('2× Chipa 1kg — R$ 80,00 ⚠️ sem estoque no sistema')
        expect(txt).not.toContain('1× Pão de Queijo 1kg - 100gr — R$ 30,00 ⚠️')
    })

    it('não marca nada quando tudo tem estoque', () => {
        const ok = itens.map((i) => ({ ...i, semEstoque: false }))
        expect(renderizarPedido(ok)).not.toContain('⚠️')
    })

    it('pedido vazio tem texto próprio, não string vazia', () => {
        expect(renderizarPedido([])).toBe('(nenhum item)')
    })
})

describe('totalPedido', () => {
    it('soma quantidade × preço', () => {
        expect(totalPedido([
            { produtoId: 'a', nome: 'A', quantidade: 2, precoUnitario: 40, semEstoque: false },
            { produtoId: 'b', nome: 'B', quantidade: 1, precoUnitario: 30, semEstoque: false },
        ])).toBe(110)
    })

    it('pedido vazio soma zero', () => {
        expect(totalPedido([])).toBe(0)
    })
})
