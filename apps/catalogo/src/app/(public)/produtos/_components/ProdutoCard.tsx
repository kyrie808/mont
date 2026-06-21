import Link from 'next/link'
import Image from 'next/image'
import type { ProdutoCatalogo } from '@mont/shared'
import { brl, descontoPct } from './format'
import { seloLabel } from './selo'
import { AddButton } from './AddButton'

export function ProdutoCard({ product }: { product: ProdutoCatalogo }) {
    const preco = product.preco ?? 0
    const ancora = product.preco_ancoragem ?? null
    const temAncora = ancora != null && ancora > preco
    const sub = product.subtitulo || product.categoria || ''
    const selo = seloLabel(product.selo)

    return (
        <Link
            href={`/produtos/${product.slug}`}
            className="group flex h-full flex-col rounded-2xl bg-card p-3 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.18)] transition-shadow duration-300 hover:shadow-[0_16px_36px_-14px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
        >
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
                {product.url_imagem_principal ? (
                    <Image
                        src={product.url_imagem_principal}
                        alt={product.nome ?? ''}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 320px"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-border-strong">
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                )}
                {selo && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground shadow-sm">
                        {selo}
                    </span>
                )}
                {temAncora && (
                    <span className="absolute right-2 top-2 rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-primary-foreground shadow-sm">
                        −{descontoPct(ancora, preco)}%
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col px-1 pt-3">
                <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">{product.nome}</h3>
                {sub && <p className="mt-0.5 line-clamp-1 text-xs capitalize text-muted-foreground">{sub}</p>}
                <div className="mt-2 flex items-baseline gap-2">
                    {temAncora && <span className="text-xs text-muted-foreground line-through">{brl(ancora)}</span>}
                    <span className="text-[17px] font-extrabold text-foreground">{brl(preco)}</span>
                </div>
                <div className="mt-auto pt-3">
                    <AddButton product={product} variant="outline" />
                </div>
            </div>
        </Link>
    )
}
