import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Navbar, Footer } from '@/components/catalog'
import ClientTracker from '@/components/analytics/ClientTracker'
import { formatCurrency } from '@/lib/utils/format'
import { getPdpData, getProdutoMeta } from './_data'
import { PdpInfo } from './_components/PdpInfo'
import { InformacaoDoProduto } from './_components/InformacaoDoProduto'
import { RecomendadosSlider } from './_components/RecomendadosSlider'

export const dynamic = 'force-dynamic'

const TEMP_LABEL: Record<string, string> = {
    refrigerado: 'Resfriado',
    congelado: 'Congelado',
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const product = await getProdutoMeta(slug)

    if (!product) {
        return { title: 'Produto não encontrado | Mont Distribuidora' }
    }

    return {
        title: `${product.nome} | Mont Distribuidora`,
        description: product.descricao || `Compre ${product.nome} - ${product.subtitulo ?? ''} por ${formatCurrency(product.preco ?? 0)}`,
    }
}

export default async function ProdutoPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const data = await getPdpData(slug)
    if (!data) notFound()

    const { product, componentes, recomendados } = data
    const temp = product.categoria ? TEMP_LABEL[product.categoria] : null

    const analyticsEvent = {
        event: 'view_item',
        ecommerce: {
            currency: 'BRL',
            value: product.preco ?? 0,
            items: [{
                item_id: product.id ?? '',
                item_name: product.nome ?? '',
                price: product.preco ?? 0,
                quantity: 1,
            }],
        },
    } as const

    return (
        <>
            <ClientTracker eventData={analyticsEvent} />
            <Navbar />
            <main className="min-h-screen bg-background pb-24 pt-28">
                <div className="mx-auto max-w-[1200px] px-4 md:px-8">
                    {/* Foto + Info */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
                        <div className="relative aspect-square overflow-hidden rounded-[28px] bg-muted">
                            {product.url_imagem_principal ? (
                                <Image
                                    src={product.url_imagem_principal}
                                    alt={product.nome ?? ''}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1024px) 100vw, 600px"
                                    priority
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-border-strong">
                                    <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                            )}
                            {temp && (
                                <span className="absolute left-4 top-4 rounded-full bg-primary px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-primary-foreground shadow-sm">
                                    {temp}
                                </span>
                            )}
                        </div>

                        <PdpInfo product={product} componentes={componentes} />
                    </div>

                    {/* Informação do produto */}
                    <div className="mt-6">
                        <InformacaoDoProduto product={product} />
                    </div>

                    {/* Você também pode gostar (slider) */}
                    <RecomendadosSlider produtos={recomendados} />
                </div>
            </main>
            <Footer />
        </>
    )
}
