/**
 * Raw DB shape from table `produtos` + joined `sis_imagens_produto`.
 * Used by admin pages that consume /api/admin/produtos directly.
 */
export interface AdminProduct {
    id: string
    nome: string
    codigo: string
    preco: number
    custo: number
    unidade: string
    ativo: boolean
    visivel_catalogo: boolean
    categoria: string | null
    descricao: string | null
    peso_kg: number | null
    subtitulo: string | null
    destaque: boolean
    slug: string | null
    preco_ancoragem: number | null
    instrucoes_preparo: string | null
    estoque_atual: number | null
    estoque_minimo: number | null
    apelido: string | null
    criado_em: string
    atualizado_em: string
    sis_imagens_produto?: { url: string }[]
}
