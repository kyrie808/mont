/**
 * Catálogo da secretária: transformar o que o cliente escreveu em produto real.
 *
 * Mora aqui pelo mesmo motivo de `secretaria.ts`: é a única pasta que o runtime Deno da
 * Edge Function E o Vitest do interno alcançam. Sem dependências.
 *
 * Existe porque em 26/09/2026 a agente anotou "500 g de chipa" — embalagem que a Mont não
 * vende. Quatro tentativas de proibir isso por prompt falharam. A regra passa a ser código.
 */

export interface ProdutoCatalogo {
    id: string
    nome: string
    /** Sinônimos curados, separados por vírgula. É como o CLIENTE chama o produto. */
    apelido: string | null
    preco: number
    estoqueAtual: number
}

export type Resolucao =
    | { tipo: 'resolvido'; produto: ProdutoCatalogo }
    | { tipo: 'ambiguo'; opcoes: ProdutoCatalogo[] }
    | { tipo: 'nao_encontrado'; opcoes: ProdutoCatalogo[] }

/**
 * Minúsculas, sem acento, sem pontuação, espaço único.
 *
 * A pontuação vira espaço em vez de sumir: cliente escreve "me vê 1kg de chipa!" e
 * "chipa!" precisa continuar casando com o sinônimo "chipa".
 */
function normalizar(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

/**
 * Peso que o cliente pediu, em gramas: "1kg" → 1000, "500g" → 500.
 *
 * Trabalha sobre o termo em minúsculas mas COM pontuação, porque "2,5kg" precisa do
 * separador decimal — `normalizar` o trocaria por espaço.
 */
function pesoPedido(termo: string): number | null {
    const t = termo.toLowerCase()
    const kg = t.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
    if (kg) return Math.round(parseFloat(kg[1].replace(',', '.')) * 1000)
    const g = t.match(/(\d+)\s*(?:g|gr|gramas?)\b/)
    if (g) return parseInt(g[1], 10)
    return null
}

/**
 * Pesos que o NOME do produto declara. "Pão de Queijo 1kg - 100gr" tem dois números: a
 * embalagem (1kg) e o tamanho da unidade (100gr). O primeiro é a embalagem.
 */
function pesosDoNome(nome: string): { embalagem: number | null; unidade: number | null } {
    const n = normalizar(nome)
    const kg = n.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
    const g = n.match(/(\d+)\s*(?:g|gr)\b/)
    return {
        embalagem: kg ? Math.round(parseFloat(kg[1].replace(',', '.')) * 1000) : null,
        unidade: g ? parseInt(g[1], 10) : null,
    }
}

function sinonimos(p: ProdutoCatalogo): string[] {
    return (p.apelido ?? '')
        .split(',')
        .map(normalizar)
        .filter(Boolean)
}

/**
 * Sinônimo tem que casar como PALAVRA INTEIRA, não como pedaço.
 *
 * "baldinho".includes("balde") é `true`, então busca por substring faria "baldinho" casar
 * com o Balde 4kg e voltar ambíguo — quando o cliente foi específico.
 *
 * Emoldurar com espaço resolve sem regex: `normalizar` já colapsou espaços e trocou
 * pontuação por espaço, então " baldinho " não contém " balde ", e " 1 kg de chipa "
 * contém " chipa ". Sem regex também não há o que escapar quando o apelido tiver
 * parêntese ou acento.
 */
function contemSinonimo(texto: string, sinonimo: string): boolean {
    return ` ${texto} `.includes(` ${sinonimo} `)
}

/**
 * `termo` é o que o cliente escreveu, cru. Devolve sempre um dos três resultados —
 * nunca escolhe no lugar dele quando há mais de uma possibilidade.
 */
export function resolverTermo(termo: string, catalogo: ProdutoCatalogo[]): Resolucao {
    const t = normalizar(termo)

    // 1. A FAMÍLIA vem do sinônimo curado, não de pedaço do nome. "pão de queijo" está
    //    dentro de "Massa Pão de Queijo", e a massa é produto cru — outra coisa.
    const familia = catalogo.filter((p) => sinonimos(p).some((s) => contemSinonimo(t, s)))
    if (familia.length === 0) return { tipo: 'nao_encontrado', opcoes: [] }

    // 2. Sem peso declarado, a escolha é do cliente.
    const peso = pesoPedido(termo)
    if (peso === null) {
        return familia.length === 1
            ? { tipo: 'resolvido', produto: familia[0] }
            : { tipo: 'ambiguo', opcoes: familia }
    }

    // 3. Com peso: casa contra a EMBALAGEM primeiro — é o que o cliente diz mais vezes.
    const naEmbalagem = familia.filter((p) => pesosDoNome(p.nome).embalagem === peso)
    if (naEmbalagem.length === 1) return { tipo: 'resolvido', produto: naEmbalagem[0] }
    if (naEmbalagem.length > 1) {
        // Mesma embalagem, tamanhos de unidade diferentes: o cliente escolhe.
        return { tipo: 'ambiguo', opcoes: naEmbalagem }
    }

    // 4. Nenhuma embalagem com esse peso. Antes de dizer que não existe, tentar o TAMANHO
    //    DA UNIDADE: "me vê o de 100g" fala da unidade, não do pacote, e o produto existe.
    const naUnidade = familia.filter((p) => pesosDoNome(p.nome).unidade === peso)
    if (naUnidade.length === 1) return { tipo: 'resolvido', produto: naUnidade[0] }
    if (naUnidade.length > 1) return { tipo: 'ambiguo', opcoes: naUnidade }

    // 5. Nem embalagem nem unidade: a Mont não vende esse peso. As opções são as DA
    //    FAMÍLIA — "chipa só tem 1kg ou 2kg" —, nunca o catálogo inteiro.
    return { tipo: 'nao_encontrado', opcoes: familia }
}
