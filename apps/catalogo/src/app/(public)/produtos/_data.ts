import { createClient } from '@/lib/supabase/server'
import type { ProdutoCatalogo } from '@mont/shared'

export interface ComboItem {
    quantidade: number
    nome: string
}

export interface VitrineAba {
    id: string
    nome: string
    slug: string
}

export interface VitrineData {
    /** Produtos com flag destaque → carrossel do topo. */
    destaques: ProdutoCatalogo[]
    /** Abas/seções ativas, na ordem (filtros da vitrine). */
    abas: VitrineAba[]
    /** Todos os produtos visíveis (grid filtra por aba via secao_id). */
    produtos: ProdutoCatalogo[]
    /** Componentes por combo (checks do slide em destaque). */
    componentesByProduto: Record<string, ComboItem[]>
}

interface ComponenteRow {
    combo_id: string
    quantidade: number | null
    componente: { nome: string } | { nome: string }[] | null
}

export async function getVitrineData(): Promise<VitrineData> {
    const supabase = await createClient()

    // Produtos visíveis, já na ordem da vitrine (ordem_vitrine, depois nome).
    const { data: produtosData } = await supabase
        .from('vw_catalogo_produtos')
        .select('*')
        .eq('visivel_catalogo', true)
        .order('ordem_vitrine', { ascending: true })
        .order('nome', { ascending: true })

    const produtos = (produtosData ?? []) as ProdutoCatalogo[]

    // Abas: seções ativas, na ordem.
    const { data: secoesData } = await supabase
        .from('cat_secoes')
        .select('id, nome, slug, ordem')
        .eq('ativa', true)
        .order('ordem', { ascending: true })

    const abas: VitrineAba[] = (secoesData ?? []).map((s) => ({ id: s.id, nome: s.nome, slug: s.slug }))

    // Destaques → carrossel.
    const destaques = produtos.filter((p) => p.destaque)

    // Componentes de combos (sinal de combo = ter componentes; categoria não marca combo).
    const ids = produtos.map((p) => p.id as string).filter(Boolean)
    const componentesByProduto: Record<string, ComboItem[]> = {}
    if (ids.length > 0) {
        const { data: comps } = await supabase
            .from('produto_componentes')
            .select('combo_id, quantidade, componente:produtos!produto_componentes_componente_id_fkey(nome)')
            .in('combo_id', ids)
            .order('criado_em')

        for (const row of (comps ?? []) as ComponenteRow[]) {
            const comp = Array.isArray(row.componente) ? row.componente[0] : row.componente
            const nome = comp?.nome ?? ''
            if (!nome) continue
            const arr = componentesByProduto[row.combo_id] ?? (componentesByProduto[row.combo_id] = [])
            arr.push({ quantidade: Number(row.quantidade ?? 0), nome })
        }
    }

    return { destaques, abas, produtos, componentesByProduto }
}
