import { supabase } from '../lib/supabase'
import type { Secao, SecaoInsert, SecaoUpdate } from '@mont/shared'

/** Sanitiza um slug pra URL-safe. 'secao' como fallback se vazio. */
function slugify(value: string | null | undefined): string {
    if (!value) return 'secao'
    const out = value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // remove diacríticos (combining marks)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return out || 'secao'
}

export interface SecaoComContagem extends Secao {
    total_itens: number
}

export interface SecaoItem {
    produto_id: string
    ordem: number
    nome: string
    preco: number
    eh_combo: boolean
    imagem_url: string | null
}

// Shapes das queries com embeds (PostgREST) — tipadas localmente p/ evitar `any`.
interface SecaoComCountRow extends Secao {
    produtos: { count: number }[]
}
interface ProdutoRow {
    id: string
    nome: string
    preco: number
    eh_combo: boolean
    ordem_vitrine: number
    sis_imagens_produto: { url: string }[] | null
}

export class SecaoService {
    /* ── Seções (abas da vitrine) ───────────────────────────────────── */

    async listSecoes(): Promise<SecaoComContagem[]> {
        const { data, error } = await supabase
            .from('cat_secoes')
            .select('*, produtos(count)')
            .order('ordem', { ascending: true })

        if (error) throw error

        return (data as SecaoComCountRow[]).map((s) => {
            const { produtos, ...secao } = s
            return { ...secao, total_itens: produtos?.[0]?.count ?? 0 }
        })
    }

    // Slug único: parte do slugify do nome e adiciona sufixo numérico se colidir.
    private async uniqueSlug(nome: string): Promise<string> {
        const base = slugify(nome)
        const { data } = await supabase.from('cat_secoes').select('slug').like('slug', `${base}%`)
        const existing = new Set((data ?? []).map((r) => r.slug))
        if (!existing.has(base)) return base
        for (let i = 2; i < 1000; i++) {
            const candidate = `${base}-${i}`
            if (!existing.has(candidate)) return candidate
        }
        return `${base}-${Date.now().toString(36)}`
    }

    async createSecao(input: { nome: string }): Promise<Secao> {
        const { data: maxRow } = await supabase
            .from('cat_secoes')
            .select('ordem')
            .order('ordem', { ascending: false })
            .limit(1)
            .maybeSingle()

        const proximaOrdem = (maxRow?.ordem ?? -1) + 1
        const slug = await this.uniqueSlug(input.nome)

        const payload: SecaoInsert = {
            nome: input.nome.trim(),
            slug,
            ordem: proximaOrdem,
            ativa: true,
        }

        const { data, error } = await supabase.from('cat_secoes').insert(payload).select('*').single()
        if (error) throw error
        return data
    }

    async updateSecao(id: string, patch: { nome?: string; ativa?: boolean }): Promise<Secao> {
        const update: SecaoUpdate = {}
        if (patch.nome !== undefined) update.nome = patch.nome.trim()
        if (patch.ativa !== undefined) update.ativa = patch.ativa
        update.updated_at = new Date().toISOString()

        const { data, error } = await supabase.from('cat_secoes').update(update).eq('id', id).select('*').single()
        if (error) throw error
        return data
    }

    async deleteSecao(id: string): Promise<void> {
        // ON DELETE SET NULL nos produtos (eles voltam pra "sem seção").
        const { error } = await supabase.from('cat_secoes').delete().eq('id', id)
        if (error) throw error
    }

    async reorderSecoes(ids: string[]): Promise<void> {
        const { error } = await supabase.rpc('reorder_secoes', { p_ids: ids })
        if (error) throw error
    }

    /* ── Itens da seção (produtos com secao_id) ─────────────────────── */
    // Atribuição é feita no cadastro do produto (produtos.secao_id). Aqui só
    // listamos, reordenamos (ordem_vitrine) e desvinculamos.

    async listItens(secaoId: string): Promise<SecaoItem[]> {
        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, preco, eh_combo, ordem_vitrine, sis_imagens_produto(url)')
            .eq('secao_id', secaoId)
            .order('ordem_vitrine', { ascending: true })

        if (error) throw error

        return (data as ProdutoRow[]).map((row) => ({
            produto_id: row.id,
            ordem: row.ordem_vitrine,
            nome: row.nome,
            preco: Number(row.preco ?? 0),
            eh_combo: row.eh_combo ?? false,
            imagem_url: row.sis_imagens_produto?.[0]?.url ?? null,
        }))
    }

    async removeItem(produtoId: string): Promise<void> {
        const { error } = await supabase.from('produtos').update({ secao_id: null }).eq('id', produtoId)
        if (error) throw error
    }

    async reorderItens(produtoIds: string[]): Promise<void> {
        const { error } = await supabase.rpc('reorder_produtos_vitrine', { p_ids: produtoIds })
        if (error) throw error
    }
}

export const secaoService = new SecaoService()
