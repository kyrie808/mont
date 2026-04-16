import { Navbar, Footer } from '@/components/catalog'
import { createClient } from '@/lib/supabase/server'
import type { ProdutoCatalogo } from '@mont/shared'
import ProductCatalog from './_components/ProductCatalog'
import FeaturedProduct from './_components/FeaturedProduct'
import StoreBanner from './_components/StoreBanner'
import IngredientsSection from './_components/IngredientsSection'
import BenefitsCarousel from './_components/BenefitsCarousel'
import TrustBar from './_components/TrustBar'
import ClientTracker from '@/components/analytics/ClientTracker'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

async function getAllProducts(): Promise<ProdutoCatalogo[]> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('vw_catalogo_produtos')
            .select('*')
            .eq('visivel_catalogo', true)
            .order('nome', { ascending: true })

        if (error || !data || data.length === 0) {
            return []
        }

        return data as ProdutoCatalogo[]

    } catch (error) {
        console.error('Erro ao buscar produtos:', error)
        return []
    }
}

export const metadata = {
    title: 'Produtos | Mont Massas',
    description: 'Conhe\u00E7a nossa linha completa de produtos artesanais.',
}

export default async function ProdutosPage() {
    const products = await getAllProducts()

    const featuredProduct = products.find(p => p.destaque);

    const analyticsEvent = {
        event: 'view_item_list',
        ecommerce: {
            item_list_id: 'catalogo_completo',
            item_list_name: 'Catálogo de Produtos',
            items: products.map((p, index) => ({
                item_id: p.id ?? '',
                item_name: p.nome ?? '',
                price: p.preco ?? 0,
                quantity: 1,
                index: index + 1
            }))
        }
    } as const;

    return (
        <>
            <ClientTracker eventData={analyticsEvent} />
            <Navbar />

            <main className="min-h-screen bg-mont-cream pt-20 pb-20">
                <StoreBanner />

                <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 mt-8 md:mt-10">
                    {featuredProduct && (
                        <FeaturedProduct product={featuredProduct} />
                    )}

                    <ProductCatalog products={products.filter(p => !featuredProduct || p.id !== featuredProduct.id)} />
                </div>

                <div className="mt-12">
                    <IngredientsSection />
                </div>
                <BenefitsCarousel />
                <TrustBar />
            </main>

            <Footer />
        </>
    )
}
