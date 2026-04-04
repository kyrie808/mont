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

/**
 * Mapped frontend shape (English). Used by public catalog pages.
 */
export interface Product {
    id: string
    name: string
    slug: string
    description: string | null
    category: 'congelado' | 'refrigerado' | 'combo'
    subtitle?: string | null
    price: number
    anchor_price?: number | null
    cost: number | null
    stock_quantity: number
    stock_min_alert: number
    is_active: boolean
    is_featured: boolean
    sort_order: number
    created_at: string
    updated_at: string
    image_url?: string | null // Deprecated: use primary_image_url
    primary_image_url: string | null
    images: ProductImage[] | null
    stock_status: string
    instrucoes_preparo?: string | null
}

export interface ProductImage {
    id: string
    product_id: string
    url: string
    alt_text: string | null
    sort_order: number
    is_primary: boolean
    created_at: string
}

export interface ProductWithImages extends Product {
    images: ProductImage[]
}
