import { Navbar, Footer } from '@/components/catalog'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { ProdutoCatalogo } from '@mont/shared'
import ImmersiveHero from './_components/hero/ImmersiveHero'
import FeaturedProducts from './_components/FeaturedProducts'
import HowItWorks from './_components/HowItWorks'
import BrandStory from './_components/BrandStory'
import FinalCTA from './_components/FinalCTA'
import HomeWrapper from './_components/HomeWrapper'

// Force dynamic rendering (não SSG)
export const dynamic = 'force-dynamic'

async function getFeaturedProducts(): Promise<ProdutoCatalogo[]> {
    try {
        const supabase = createClient()

        const { data, error } = await supabase
            .from('vw_catalogo_produtos')
            .select('*')
            .eq('visivel_catalogo', true)
            .eq('destaque', true)
            .limit(10)

        if (error || !data) {
            return []
        }

        return data as ProdutoCatalogo[]

    } catch (error) {
        console.error('Erro ao buscar produtos:', error)
        return []
    }
}

export default async function HomePage() {
    const featuredProducts = await getFeaturedProducts()

    return (
        <>
            <Navbar />

            <HomeWrapper>
                <ImmersiveHero />
                {featuredProducts.length > 0 && (
                    <FeaturedProducts products={featuredProducts} />
                )}

                {/* CTA Ver Todos os Produtos */}
                <div className="flex justify-center py-12">
                    <Link
                        href="/produtos"
                        className="inline-flex items-center gap-2 bg-mont-espresso text-mont-cream font-body font-medium px-8 py-4 rounded-full hover:bg-mont-gold hover:text-mont-espresso transition-all duration-300 text-lg"
                    >
                        Ver todos os produtos
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    </Link>
                </div>

                <HowItWorks />
                <BrandStory />
                <FinalCTA />
            </HomeWrapper>

            <Footer />
        </>
    )
}
