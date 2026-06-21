import { Navbar, Footer } from '@/components/catalog'
import ClientTracker from '@/components/analytics/ClientTracker'
import { getVitrineData } from './_data'
import { FeaturedCarousel } from './_components/FeaturedCarousel'
import { VitrineTabs } from './_components/VitrineTabs'
import IngredientsSection from './_components/IngredientsSection'
import BenefitsCarousel from './_components/BenefitsCarousel'
import TrustBar from './_components/TrustBar'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Produtos | Mont Distribuidora',
    description: 'Conheça nossa linha completa de pães de queijo e combos artesanais.',
}

export default async function ProdutosPage() {
    const { destaques, abas, produtos, componentesByProduto } = await getVitrineData()

    const analyticsEvent = {
        event: 'view_item_list',
        ecommerce: {
            item_list_id: 'catalogo_completo',
            item_list_name: 'Catálogo de Produtos',
            items: produtos.map((p, index) => ({
                item_id: p.id ?? '',
                item_name: p.nome ?? '',
                price: p.preco ?? 0,
                quantity: 1,
                index: index + 1,
            })),
        },
    } as const

    return (
        <>
            <ClientTracker eventData={analyticsEvent} />
            <Navbar />

            <main className="min-h-screen bg-background pb-24 pt-28">
                <div className="mx-auto max-w-[1400px] px-4 md:px-8">
                    <h1 className="mb-6 text-3xl font-extrabold text-foreground md:text-4xl">
                        Nossos produtos
                    </h1>

                    {produtos.length === 0 ? (
                        <p className="py-20 text-center text-muted-foreground">Nenhum produto encontrado.</p>
                    ) : (
                        <>
                            <FeaturedCarousel destaques={destaques} componentesByProduto={componentesByProduto} />
                            <VitrineTabs abas={abas} produtos={produtos} />
                        </>
                    )}
                </div>

                {/* Conteúdo de marca / conversão */}
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
