import { supabase } from '../lib/supabase'
import type {
    ProdutoInsert,
    ProdutoUpdate
} from '@mont/shared'
import type { DomainProduto, CreateProduto, UpdateProduto, DomainProdutoComponente } from '../types/domain'
import { toDomainProduto } from './mappers'

/** Sanitiza um slug pra URL-safe (o catálogo resolve produto por slug). null se vazio. */
function slugify(value: string | null | undefined): string | null {
    if (!value) return null
    const out = value
        .normalize('NFD')
        .replace(/[^\x00-\x7f]/g, '') // remove acentos/combining marks (não-ASCII)
        .toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    return out || null
}

export class ProdutoService {
    /* CRUD */
    async getAll(includeInactive: boolean = false): Promise<DomainProduto[]> {
        let query = supabase
            .from('produtos')
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, eh_combo')
            .order('nome')

        if (!includeInactive) {
            query = query.eq('ativo', true)
        }

        const { data, error } = await query
        if (error) throw error

        // Buscar imagens só dos produtos retornados (evita varrer a tabela inteira)
        const ids = (data || []).map((p) => p.id)
        const { data: imagens } = ids.length
            ? await supabase
                .from('sis_imagens_produto')
                .select('produto_id, url')
                .in('produto_id', ids)
            : { data: [] as { produto_id: string | null; url: string }[] }

        // Merge manual
        const imagensMap = new Map(imagens?.map((i) => [i.produto_id!, i.url]) ?? [])

        return (data || []).map((p: any) => toDomainProduto({
            ...p,
            sis_imagens_produto: imagensMap.has(p.id)
                ? { url: imagensMap.get(p.id)! }
                : null
        }))
    }

    async getById(id: string): Promise<DomainProduto | null> {
        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, eh_combo, sis_imagens_produto(url)')
            .eq('id', id)
            .single()

        if (error) {
            console.error('Erro ao buscar produto por ID:', error)
            return null
        }

        return toDomainProduto(data)
    }

    async create(data: CreateProduto): Promise<DomainProduto> {
        // Map domain to database insert
        const dbInsert: ProdutoInsert = {
            nome: data.nome,
            codigo: data.codigo,
            preco: data.preco,
            custo: data.custo,
            unidade: data.unidade || 'un',
            apelido: data.apelido || null,
            subtitulo: data.subtitulo || null,
            estoque_minimo: data.estoqueMinimo || 0,
            ativo: data.ativo ?? true,
            categoria: data.categoria || null,
            preco_ancoragem: data.precoAncoragem ?? data.preco_ancoragem ?? null,
            // Apresentação no catálogo (consolidado no interno)
            descricao: data.descricao ?? null,
            peso_kg: data.pesoKg != null && data.pesoKg >= 0 ? data.pesoKg : null,
            destaque: data.destaque ?? false,
            slug: slugify(data.slug),
            instrucoes_preparo: data.instrucoesPreparo ?? null,
            visivel_catalogo: data.visivelCatalogo ?? true,
            eh_combo: data.ehCombo ?? false
        }

        const { data: created, error } = await supabase
            .from('produtos')
            .insert(dbInsert)
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, eh_combo, sis_imagens_produto(url)')
            .single()

        if (error) {
            console.error('Erro ao criar produto:', error)
            throw new Error(`Erro ao criar produto: ${error.message}`)
        }

        return toDomainProduto(created)
    }

    async update(id: string, data: UpdateProduto): Promise<DomainProduto> {
        const dbUpdate: ProdutoUpdate = {}
        if (data.nome !== undefined) dbUpdate.nome = data.nome
        if (data.codigo !== undefined) dbUpdate.codigo = data.codigo
        if (data.preco !== undefined) dbUpdate.preco = data.preco
        if (data.custo !== undefined) dbUpdate.custo = data.custo
        if (data.unidade !== undefined) dbUpdate.unidade = data.unidade
        if (data.apelido !== undefined) dbUpdate.apelido = data.apelido
        if (data.subtitulo !== undefined) dbUpdate.subtitulo = data.subtitulo
        if (data.estoqueMinimo !== undefined) dbUpdate.estoque_minimo = data.estoqueMinimo
        if (data.ativo !== undefined) dbUpdate.ativo = data.ativo
        if (data.preco_ancoragem !== undefined) dbUpdate.preco_ancoragem = data.preco_ancoragem
        if (data.precoAncoragem !== undefined) dbUpdate.preco_ancoragem = data.precoAncoragem
        if (data.categoria !== undefined) dbUpdate.categoria = data.categoria
        // Apresentação no catálogo (consolidado no interno)
        if (data.descricao !== undefined) dbUpdate.descricao = data.descricao
        if (data.pesoKg !== undefined) dbUpdate.peso_kg = data.pesoKg != null && data.pesoKg >= 0 ? data.pesoKg : null
        if (data.destaque !== undefined) dbUpdate.destaque = data.destaque
        if (data.slug !== undefined) dbUpdate.slug = slugify(data.slug)
        if (data.instrucoesPreparo !== undefined) dbUpdate.instrucoes_preparo = data.instrucoesPreparo
        if (data.visivelCatalogo !== undefined) dbUpdate.visivel_catalogo = data.visivelCatalogo
        if (data.ehCombo !== undefined) dbUpdate.eh_combo = data.ehCombo

        const { data: updated, error } = await supabase
            .from('produtos')
            .update(dbUpdate)
            .eq('id', id)
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, eh_combo, sis_imagens_produto(url)')
            .single()

        if (error) {
            console.error('Erro ao atualizar produto:', error)
            throw new Error(`Erro ao atualizar produto: ${error.message}`)
        }

        return toDomainProduto(updated)
    }

    async updateEstoque(id: string, quantidade: number): Promise<DomainProduto> {
        const { data: updated, error } = await supabase
            .from('produtos')
            .update({ estoque_atual: quantidade })
            .eq('id', id)
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, eh_combo, sis_imagens_produto(url)')
            .single()

        if (error) {
            console.error('Erro ao atualizar estoque:', error)
            throw new Error(`Erro ao atualizar estoque: ${error.message}`)
        }

        return toDomainProduto(updated)
    }

    /* IMAGENS */
    async uploadImage(file: File, oldImageUrl?: string | null): Promise<string> {
        // Upload via Edge Function (service_role): o Storage rejeita o JWT do interno
        // (descompasso de chave JWT entre serviços), então a function sobe com service_role
        // e valida admin via is_admin. Remoção do arquivo antigo também acontece na function.
        const form = new FormData()
        form.append('file', file)
        if (oldImageUrl) form.append('old_url', oldImageUrl)

        const { data, error } = await supabase.functions.invoke('upload-product-image', { body: form })
        if (error) throw error
        if (!data?.url) throw new Error(data?.error || 'Falha no upload da imagem')

        return data.url as string
    }

    /* COMBOS — composição (produto_componentes). Nomes/preços dos componentes
       são resolvidos na UI a partir da lista de produtos já carregada. */
    async getComponentes(comboId: string): Promise<DomainProdutoComponente[]> {
        const { data, error } = await supabase
            .from('produto_componentes')
            .select('id, combo_id, componente_id, quantidade')
            .eq('combo_id', comboId)
            .order('criado_em')

        if (error) throw error

        return (data || []).map((row) => ({
            id: row.id,
            comboId: row.combo_id,
            componenteId: row.componente_id,
            quantidade: Number(row.quantidade || 0)
        }))
    }

    // Substitui toda a composição do combo de forma ATÔMICA (RPC: delete+insert numa
    // transação). Itens vazio = limpa (desfaz o combo). Evita o estado "combo vazio"
    // que o delete+insert client-side deixava se o insert falhasse após o delete.
    async replaceComponentes(comboId: string, itens: { componenteId: string; quantidade: number }[]): Promise<void> {
        const { error } = await supabase.rpc('replace_combo_componentes', {
            p_combo_id: comboId,
            p_itens: itens.map((i) => ({ componenteId: i.componenteId, quantidade: i.quantidade })),
        })
        if (error) throw error
    }

    async addImageReference(produtoId: string, url: string): Promise<void> {
        const { error } = await supabase.rpc('add_image_reference', {
            p_produto_id: produtoId,
            p_url: url
        })

        if (error) throw error
    }

    async deleteImage(produtoId: string, imageUrl: string): Promise<void> {
        const fileName = imageUrl.split('/').pop()
        if (!fileName) throw new Error('URL de imagem inválida')

        // 1. Remove das tabelas via RPC
        const { error: rpcError } = await supabase
            .rpc('delete_image_reference', { p_produto_id: produtoId })
        if (rpcError) throw rpcError

        // 2. Deleta arquivo do bucket
        const { error: storageError } = await supabase
            .storage.from('products').remove([fileName])
        if (storageError) console.warn('[DeleteImage] Storage error:', storageError)
    }
}

export const produtoService = new ProdutoService()
