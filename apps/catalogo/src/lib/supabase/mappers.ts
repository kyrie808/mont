import type { Product, ProductImage } from '@/types/product'

/**
 * Schema real do banco (tabela produtos + view vw_catalogo_produtos)
 */
export interface ProdutoDatabase {
    id: string
    nome: string
    codigo: string
    slug: string
    descricao: string | null
    category: 'congelado' | 'refrigerado' | 'combo' // Vem da view
    subtitle?: string | null // Vem da view
    price_cents: number // Vem da view
    anchor_price_cents?: number | string | null // Vem da view
    price_formatted: string // Vem da view
    estoque_atual: number | null
    estoque_minimo: number | null
    ativo: boolean
    is_featured: boolean // Vem da view
    stock_status: string // Vem da view
    primary_image_url: string | null // Vem da view
    images: ProductImage[] | null // Vem da view (json)
    instrucoes_preparo?: string | null // Vem da view
    criado_em?: string
    atualizado_em?: string
}

/**
 * Mapeia produto do banco para o type Product usado no frontend
 */
export function mapProdutoToProduct(produto: ProdutoDatabase): Product {
    return {
        id: produto.id,
        name: produto.nome,
        slug: produto.slug,
        description: produto.descricao,
        category: produto.category,
        subtitle: produto.subtitle || null,
        price_cents: produto.price_cents,
        anchor_price_cents: produto.anchor_price_cents
            ? Number(produto.anchor_price_cents)
            : null,
        cost_cents: 0, // Não vem da view pública por segurança
        stock_quantity: produto.estoque_atual || 0,
        stock_min_alert: produto.estoque_minimo || 5,
        is_active: produto.ativo,
        is_featured: produto.is_featured,
        sort_order: 0,
        created_at: produto.criado_em || new Date().toISOString(),
        updated_at: produto.atualizado_em || new Date().toISOString(),
        primary_image_url: produto.primary_image_url,
        images: produto.images || [],
        stock_status: produto.stock_status,
        instrucoes_preparo: produto.instrucoes_preparo || null,
    }
}

/**
 * Dados mockados como fallback (caso tabela esteja vazia)
 */
export const MOCK_PRODUCTS: Product[] = [
    {
        id: '1',
        name: 'Chipa Congelada 2kg',
        slug: 'chipa-congelada-2kg',
        description: 'Chipa artesanal congelada, pronta para assar. Receita tradicional paraguaia com queijo de primeira qualidade.',
        category: 'congelado',
        subtitle: '2kg',
        price_cents: 6000,
        cost_cents: 3300,
        stock_quantity: 20,
        stock_min_alert: 5,
        is_active: true,
        is_featured: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: null, // Sem imagem ainda
        images: [],
        stock_status: 'em_estoque',
    },
    {
        id: '2',
        name: 'Palito de Queijo Congelado 2kg',
        slug: 'palito-queijo-congelado-2kg',
        description: 'Palitos de queijo crocantes, congelados e prontos para fritar. Perfeitos para festas e lanches.',
        category: 'congelado',
        subtitle: '2kg',
        price_cents: 6000,
        cost_cents: 3300,
        stock_quantity: 15,
        stock_min_alert: 5,
        is_active: true,
        is_featured: true,
        sort_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: null, // Sem imagem ainda
        images: [],
        stock_status: 'em_estoque',
    },
    {
        id: '3',
        name: 'Pão de Queijo Congelado 1kg',
        slug: 'pao-queijo-congelado-1kg',
        description: 'Pão de queijo mineiro tradicional, congelado e pronto para assar. Massa leve e saborosa.',
        category: 'congelado',
        subtitle: '1kg',
        price_cents: 2500,
        cost_cents: 1300,
        stock_quantity: 30,
        stock_min_alert: 5,
        is_active: true,
        is_featured: true,
        sort_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/pao-de-queijo-congelado-1kg-10un-100g-cover.webp',
        images: [],
        stock_status: 'em_estoque',
    },
    {
        id: '4',
        name: 'Pão de Queijo Congelado 2kg',
        slug: 'pao-queijo-congelado-2kg',
        description: 'Pão de queijo mineiro tradicional, congelado e pronto para assar. Embalagem econômica.',
        category: 'congelado',
        subtitle: '2kg',
        price_cents: 5000,
        cost_cents: 2600,
        stock_quantity: 25,
        stock_min_alert: 5,
        is_active: true,
        is_featured: false,
        sort_order: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/pao-de-queijo-congelado-2kg-40un-50g-cover.webp',
        images: [],
        stock_status: 'em_estoque',
    },
    {
        id: '5',
        name: 'Massa Pão de Queijo 1kg (Refrigerado)',
        slug: 'massa-pao-queijo-1kg',
        description: 'Massa fresca de pão de queijo refrigerada, pronta para modelar e assar.',
        category: 'refrigerado',
        subtitle: '1kg',
        price_cents: 2500,
        cost_cents: 1300,
        stock_quantity: 10,
        stock_min_alert: 5,
        is_active: true,
        is_featured: false,
        sort_order: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/balde-massa-1kg-cover.webp',
        images: [],
        stock_status: 'em_estoque',
    },
    {
        id: '6',
        name: 'Massa Pão de Queijo 4kg (Refrigerado)',
        slug: 'massa-pao-queijo-4kg',
        description: 'Massa fresca de pão de queijo refrigerada em embalagem econômica.',
        category: 'refrigerado',
        subtitle: '4kg',
        price_cents: 6500,
        cost_cents: 4100,
        stock_quantity: 8,
        stock_min_alert: 5,
        is_active: true,
        is_featured: false,
        sort_order: 6,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        primary_image_url: 'https://herlvujykltxnwqmwmyx.supabase.co/storage/v1/object/public/products/balde-massa-4kg-cover.webp',
        images: [],
        stock_status: 'em_estoque',
    },
]
