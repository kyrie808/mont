import type { BairroFixo } from '../services/configuracoesService'

/** "Vila Nova" e "vila nova" (ou "Sao Paulo" e "São Paulo") são o mesmo bairro/cidade. */
export function normalizarNome(texto: string): string {
    return texto
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
}

export type ResultadoBairros = { ok: true; bairros: BairroFixo[] } | { ok: false; erro: string }

/**
 * Bairros com valor fixo da aba Frete, prontos para gravar: sem espaço sobrando, todos preenchidos,
 * valor maior que zero e sem o mesmo bairro duas vezes na mesma cidade.
 */
export function prepararBairrosFixos(lista: BairroFixo[]): ResultadoBairros {
    const bairros = lista.map((b) => ({ bairro: b.bairro.trim().replace(/\s+/g, ' '), cidade: b.cidade.trim().replace(/\s+/g, ' '), valor: b.valor }))
    const vistos = new Set<string>()
    for (const b of bairros) {
        if (!b.bairro || !b.cidade) return { ok: false, erro: 'Preencha o bairro e a cidade de todos os bairros com valor fixo' }
        if (!Number.isFinite(b.valor) || b.valor <= 0) return { ok: false, erro: `Informe o valor do frete de ${b.bairro}` }
        const chave = `${normalizarNome(b.bairro)}|${normalizarNome(b.cidade)}`
        if (vistos.has(chave)) return { ok: false, erro: `${b.bairro} (${b.cidade}) está duas vezes` }
        vistos.add(chave)
    }
    return { ok: true, bairros: bairros.map((b) => ({ ...b, valor: Math.round(b.valor * 100) / 100 })) }
}
