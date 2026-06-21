import { createClient } from '@/lib/supabase/server'
import type { ProdutoCatalogo } from '@mont/shared'
import type { ComboItem } from '../_data'

export interface PdpData {
    product: ProdutoCatalogo
    componentes: ComboItem[]
    recomendados: ProdutoCatalogo[]
}

interface ComponenteRow {
    quantidade: number | null
    componente: { nome: string } | { nome: string }[] | null
}
interface CopurchaseRow {
    produto_id: string
    score: number
}

const RECO_MIN = 4
const RECO_MAX = 8

/** Busca enxuta só p/ generateMetadata (SEO) — evita o getPdpData completo. */
export async function getProdutoMeta(slug: string): Promise<Pick<ProdutoCatalogo, 'nome' | 'descricao' | 'subtitulo' | 'preco'> | null> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('vw_catalogo_produtos')
        .select('nome, descricao, subtitulo, preco')
        .eq('slug', slug)
        .maybeSingle()
    return (data as Pick<ProdutoCatalogo, 'nome' | 'descricao' | 'subtitulo' | 'preco'> | null) ?? null
}

export async function getPdpData(slug: string): Promise<PdpData | null> {
    const supabase = await createClient()

    const { data: prod } = await supabase
        .from('vw_catalogo_produtos')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

    if (!prod) return null
    const product = prod as ProdutoCatalogo
    const productId = product.id as string

    // Todos os visíveis (resolve ids do RPC + fallback por categoria).
    const { data: todosData } = await supabase
        .from('vw_catalogo_produtos')
        .select('*')
        .eq('visivel_catalogo', true)
    const todos = (todosData ?? []) as ProdutoCatalogo[]
    const byId = new Map(todos.map((p) => [p.id as string, p]))

    // Componentes (se for combo).
    let componentes: ComboItem[] = []
    if (productId) {
        const { data: comps } = await supabase
            .from('produto_componentes')
            .select('quantidade, componente:produtos!produto_componentes_componente_id_fkey(nome)')
            .eq('combo_id', productId)
            .order('criado_em')

        componentes = (comps as ComponenteRow[] | null ?? [])
            .map((row) => {
                const c = Array.isArray(row.componente) ? row.componente[0] : row.componente
                return { quantidade: Number(row.quantidade ?? 0), nome: c?.nome ?? '' }
            })
            .filter((c) => c.nome)
    }

    // Recomendados: co-compra real + fallback (mesma categoria → qualquer).
    const recomendados: ProdutoCatalogo[] = []
    const seen = new Set<string>([productId])

    const { data: rec } = await supabase.rpc('produtos_comprados_juntos', {
        p_produto_id: productId,
        p_limit: RECO_MAX,
    })
    for (const r of (rec as CopurchaseRow[] | null ?? [])) {
        const p = byId.get(r.produto_id)
        if (p && !seen.has(p.id as string)) {
            recomendados.push(p)
            seen.add(p.id as string)
        }
    }

    if (recomendados.length < RECO_MIN) {
        // mesma categoria primeiro
        for (const p of todos) {
            if (recomendados.length >= RECO_MIN) break
            if (seen.has(p.id as string)) continue
            if (product.categoria && p.categoria === product.categoria) {
                recomendados.push(p)
                seen.add(p.id as string)
            }
        }
        // completa com qualquer um
        for (const p of todos) {
            if (recomendados.length >= RECO_MIN) break
            if (seen.has(p.id as string)) continue
            recomendados.push(p)
            seen.add(p.id as string)
        }
    }

    return { product, componentes, recomendados: recomendados.slice(0, RECO_MAX) }
}
