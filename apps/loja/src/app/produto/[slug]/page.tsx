import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { PaginaProduto } from '@/components/produto/PaginaProduto'
import { ambiente } from '@/lib/ambiente'
import { catalogoDa } from '@/lib/sacola/calculo'
import { metadadosDoProduto } from '@/lib/seo'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import { compradosJuntos, MAXIMO_JUNTOS } from '@/lib/vitrine/compradosJuntos'
import { vitrineDaRequisicao } from '@/lib/vitrine/carregar'

type Parametros = { params: Promise<{ slug: string }> }

/** Produto à venda na loja pelo slug do cadastro (combo tem a própria página, /combo/[slug]). */
async function produtoDoSlug(slug: string) {
    const vitrine = await vitrineDaRequisicao()
    const catalogo = catalogoDa(vitrine)
    const produto = [...catalogo.produtos.values()].find((p) => p.slug === slug)
    return { vitrine, catalogo, produto }
}

export async function generateMetadata({ params }: Parametros): Promise<Metadata> {
    const { slug } = await params
    const { produto } = await produtoDoSlug(slug)
    return produto ? metadadosDoProduto(produto, `/produto/${produto.slug}`) : {}
}

/** Quem comprou este também comprou (mesma RPC do catálogo antigo). Falhou: só o complemento. */
async function coCompra(produtoId: string): Promise<string[]> {
    const { data, error } = await (await criarClienteServidor()).rpc('produtos_comprados_juntos', {
        p_produto_id: produtoId,
        p_limit: MAXIMO_JUNTOS,
    })
    if (error) {
        console.error('[loja] falha ao ler os comprados juntos', error.message)
        return []
    }
    return (data ?? []).map((r) => r.produto_id)
}

export default async function PaginaDoProduto({ params }: Parametros) {
    const { slug } = await params
    const { vitrine, catalogo, produto } = await produtoDoSlug(slug)
    if (!produto) {
        if ([...catalogo.combos.values()].some((c) => c.slug === slug)) redirect(`/combo/${slug}`)
        notFound()
    }
    const juntos = compradosJuntos(produto, await coCompra(produto.id), [...catalogo.produtos.values()])
    return (
        <Suspense>
            <PaginaProduto produto={produto} vitrine={vitrine} juntos={juntos} whatsapp={ambiente().NEXT_PUBLIC_WHATSAPP_NUMBER} />
        </Suspense>
    )
}
