import type { Database } from '@mont/shared'
import { supabase } from '../lib/supabase'

export type Tag = Database['public']['Tables']['tags']['Row']

export interface ContatoTagEntry {
    contato_id: string
    tag_id: string
    tag: Tag
}

interface CriarTagInput {
    nome: string
    cor: string
}

interface TagContatoInput {
    contatoId: string
    tagId: string
}

class TagService {
    async listTags(): Promise<Tag[]> {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('nome')

        if (error) throw new Error(`Erro ao listar tags: ${error.message}`)
        return data ?? []
    }

    async listContatoTags(): Promise<ContatoTagEntry[]> {
        const { data: ctRows, error: e1 } = await supabase
            .from('contato_tags')
            .select('contato_id, tag_id')

        if (e1) throw new Error(`Erro ao listar associações de tags: ${e1.message}`)
        if (!ctRows || ctRows.length === 0) return []

        const tagIds = [...new Set(ctRows.map((r) => r.tag_id))]

        const { data: tagRows, error: e2 } = await supabase
            .from('tags')
            .select('*')
            .in('id', tagIds)

        if (e2) throw new Error(`Erro ao buscar tags: ${e2.message}`)

        const tagMap = new Map((tagRows ?? []).map((t) => [t.id, t]))

        return ctRows
            .map((ct) => {
                const tag = tagMap.get(ct.tag_id)
                if (!tag) return null
                return { contato_id: ct.contato_id, tag_id: ct.tag_id, tag }
            })
            .filter((e): e is ContatoTagEntry => e !== null)
    }

    async criarTag({ nome, cor }: CriarTagInput): Promise<Tag> {
        const insert: Database['public']['Tables']['tags']['Insert'] = { nome, cor }
        const { data, error } = await supabase
            .from('tags')
            .insert(insert)
            .select()
            .single()

        if (error) {
            if (error.code === '23505') throw new Error('Já existe uma tag com esse nome')
            throw new Error(`Erro ao criar tag: ${error.message}`)
        }
        return data
    }

    async aplicarTag({ contatoId, tagId }: TagContatoInput): Promise<void> {
        const insert: Database['public']['Tables']['contato_tags']['Insert'] = {
            contato_id: contatoId,
            tag_id: tagId,
        }
        const { error } = await supabase.from('contato_tags').insert(insert)
        if (error) throw new Error(`Erro ao aplicar tag: ${error.message}`)
    }

    async removerTag({ contatoId, tagId }: TagContatoInput): Promise<void> {
        const { error } = await supabase
            .from('contato_tags')
            .delete()
            .eq('contato_id', contatoId)
            .eq('tag_id', tagId)
        if (error) throw new Error(`Erro ao remover tag: ${error.message}`)
    }
}

export const tagService = new TagService()
