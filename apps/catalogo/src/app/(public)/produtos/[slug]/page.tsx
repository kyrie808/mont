import { Navbar, Footer } from '@/components/catalog'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/format'
import { Badge } from '@/components/ui'
import type { ProdutoCatalogo } from '@mont/shared'
import AddToCartSection from './_components/AddToCartSection'
import RelatedProducts from './_components/RelatedProducts'
import { notFound } from 'next/navigation'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

async function getProduct(slug: string): Promise<ProdutoCatalogo | null> {
    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('vw_catalogo_produtos')
            .select('*')
            .eq('slug', slug)
            .single()

        if (error || !data) {
            return null
        }

        return data as ProdutoCatalogo

    } catch (error) {
        console.error('Erro ao buscar produto:', error)
        return null
    }
}

async function getRelatedProducts(category: string, currentId: string): Promise<ProdutoCatalogo[]> {
    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('vw_catalogo_produtos')
            .select('*')
            .eq('visivel_catalogo', true)
            .neq('id', currentId)

        if (error || !data) {
            return []
        }

        // Prioriza mesma categoria, depois os demais
        const mesmaCategoria = data.filter(p => p.categoria === category)
        const outrosCategoria = data.filter(p => p.categoria !== category)
        const ordenados = [...mesmaCategoria, ...outrosCategoria].slice(0, 6)

        return ordenados as ProdutoCatalogo[]

    } catch (error) {
        console.error('Erro ao buscar produtos relacionados:', error)
        return []
    }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
    const product = await getProduct(params.slug)

    if (!product) {
        return {
            title: 'Produto não encontrado | Mont Distribuidora',
        }
    }

    return {
        title: `${product.nome} | Mont Distribuidora`,
        description: product.descricao || `Compre ${product.nome} - ${product.subtitulo} por ${formatCurrency(product.preco ?? 0)}`,
    }
}

export default async function ProdutoPage({ params }: { params: { slug: string } }) {
    const product = await getProduct(params.slug)

    if (!product) {
        notFound()
    }

    const relatedProducts = await getRelatedProducts(product.categoria ?? '', product.id!)

    return (
        <>
            <Navbar />

            <main className="min-h-screen bg-mont-cream pt-28 pb-20">
                <div className="container mx-auto px-4">
                    <div className="max-w-6xl mx-auto">
                        {/* Grid: Imagem + Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-start">
                            {/* Imagem */}
                            <div className="aspect-square bg-mont-surface rounded-lg overflow-hidden flex items-center justify-center lg:mt-10">
                                {product.url_imagem_principal ? (
                                    <div className="relative aspect-square w-full">
                                        <Image
                                            src={product.url_imagem_principal}
                                            alt={product.nome ?? ''}
                                            fill
                                            className="object-cover"
                                            priority
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg className="w-32 h-32 text-mont-gray/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <h1 className="font-display text-4xl md:text-5xl text-mont-espresso mb-3">
                                    {product.nome}
                                </h1>

                                <div className="mb-4">
                                    {product.categoria && <Badge variant={product.categoria as any} />}
                                </div>

                                <p className="text-mont-gray text-lg mb-6">
                                    {product.subtitulo}
                                </p>

                                <div className="mb-8">
                                    {product.preco_ancoragem && (
                                        <span className="text-lg text-gray-400 line-through">
                                            {formatCurrency(product.preco_ancoragem)}
                                        </span>
                                    )}
                                    <div className="text-4xl font-bold text-mont-gold">
                                        {formatCurrency(product.preco ?? 0)}
                                    </div>
                                </div>

                                {product.descricao && (
                                    <div className="mb-8">
                                        <h2 className="font-display text-2xl text-mont-espresso mb-3">
                                            Sobre o produto
                                        </h2>
                                        <p className="text-mont-gray leading-relaxed whitespace-pre-line">
                                            {product.descricao}
                                        </p>
                                    </div>
                                )}

                                {product.instrucoes_preparo && (
                                    <div className="bg-mont-surface p-6 rounded-lg mb-8">
                                        <h3 className="font-display text-xl text-mont-espresso mb-3">
                                            ❄️ Instruções de Preparo
                                        </h3>
                                        <ul className="text-mont-gray space-y-2">
                                            {product.instrucoes_preparo.split('\n').map((linha, i) => (
                                                <li key={i}>• {linha}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Desktop: AddToCart inline */}
                                <div className="hidden lg:block">
                                    <AddToCartSection product={product} />
                                </div>
                            </div>
                        </div>

                        {/* Produtos Relacionados */}
                        {relatedProducts.length > 0 && (
                            <RelatedProducts products={relatedProducts} />
                        )}
                    </div>
                </div>
            </main>

            {/* Mobile: AddToCart fixo no bottom */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-mont-white border-t border-mont-surface p-4 shadow-lg z-50">
                <AddToCartSection product={product} compact />
            </div>

            <Footer />
        </>
    )
}
