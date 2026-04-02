import { supabase } from '../lib/supabase'
import type {
    ProdutoInsert,
    ProdutoUpdate
} from '../types/database'
import type { DomainProduto, CreateProduto, UpdateProduto } from '../types/domain'
import { toDomainProduto } from './mappers'

export class ProdutoService {
    /* CRUD */
    async getAll(includeInactive: boolean = false): Promise<DomainProduto[]> {
        let query = supabase
            .from('produtos')
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg')
            .order('nome')

        if (!includeInactive) {
            query = query.eq('ativo', true)
        }

        const { data, error } = await query
        if (error) throw error

        // Buscar imagens separadamente
        const { data: imagens } = await supabase
            .from('sis_imagens_produto')
            .select('produto_id, url')

        // Merge manual
        const imagensMap = new Map(imagens?.map(i => [i.produto_id, i.url]) ?? [])

        return (data || []).map(p => toDomainProduto({
            ...p,
            sis_imagens_produto: imagensMap.has(p.id)
                ? { url: imagensMap.get(p.id)! }
                : null
        }))
    }

    async getById(id: string): Promise<DomainProduto | null> {
        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, sis_imagens_produto(url)')
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
            ativo: true
        }

        const { data: created, error } = await supabase
            .from('produtos')
            .insert(dbInsert)
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, sis_imagens_produto(url)')
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

        const { data: updated, error } = await supabase
            .from('produtos')
            .update(dbUpdate)
            .eq('id', id)
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, sis_imagens_produto(url)')
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
            .select('id, nome, apelido, subtitulo, codigo, preco, custo, preco_ancoragem, unidade, estoque_atual, estoque_minimo, ativo, criado_em, atualizado_em, categoria, descricao, destaque, slug, visivel_catalogo, instrucoes_preparo, peso_kg, sis_imagens_produto(url)')
            .single()

        if (error) {
            console.error('Erro ao atualizar estoque:', error)
            throw new Error(`Erro ao atualizar estoque: ${error.message}`)
        }

        return toDomainProduto(updated)
    }

    /* IMAGENS */
    async uploadImage(file: File, oldImageUrl?: string | null): Promise<string> {
        // Deleta arquivo antigo do bucket se existir
        if (oldImageUrl) {
            const oldFileName = oldImageUrl.split('/').pop()
            if (oldFileName) {
                await supabase.storage.from('products').remove([oldFileName])
            }
        }

        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            })

        if (uploadError) {
            console.error('DEBUG: Erro no upload:', uploadError)
            throw uploadError
        }

        const { data } = supabase.storage
            .from('products')
            .getPublicUrl(fileName)

        return data.publicUrl
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
