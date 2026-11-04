import type { Metadata } from 'next'
import type { ProdutoLoja } from '@/lib/vitrine/tipos'

// Título, descrição, prévia do link (Open Graph) e endereço canônico da loja (Parte D da paridade).

/** Domínio final da loja (hoje ainda do catálogo antigo): o canônico e o sitemap apontam para ele. */
export const DOMINIO_FINAL = 'https://www.montdistribuidora.com.br'

export const TITULO_LOJA = 'Mont Distribuidora | Pão de queijo e doces mineiros'
export const DESCRICAO_LOJA = 'Queijo Canastra de verdade. Entregamos no ABC e em São Paulo.'
/** Imagem da prévia da home e dos produtos sem foto (provisória: logo, 1280×853). */
export const IMAGEM_LOJA = { url: '/logo-mont.png', width: 1280, height: 853, alt: 'Mont Distribuidora' }

/**
 * Endereço que serve a loja agora: o domínio de produção que a Vercel informa
 * (VERCEL_PROJECT_PRODUCTION_URL, definida pela própria Vercel). Fora da Vercel, o servidor local.
 */
export function urlDoSite(): URL {
    const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL
    return new URL(dominio ? `https://${dominio}` : `http://localhost:${process.env.PORT ?? 3000}`)
}

/** Frase da prévia: o subtítulo do cadastro, senão a 1ª linha da descrição, senão a frase da loja. Sem preço. */
export function descricaoDoProduto(p: Pick<ProdutoLoja, 'subtitulo' | 'descricao'>): string {
    const subtitulo = p.subtitulo?.trim()
    if (subtitulo) return subtitulo
    const primeiraLinha = (p.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .find(Boolean)
    return primeiraLinha ?? DESCRICAO_LOJA
}

/** Metadados de uma página da loja (home, produto, combo): título, descrição, prévia e canônico. */
export function metadadosDaPagina(caminho: string, titulo: string, descricao: string, imagem?: string | null): Metadata {
    return {
        title: titulo,
        description: descricao,
        alternates: { canonical: new URL(caminho, DOMINIO_FINAL).toString() },
        openGraph: {
            type: 'website',
            locale: 'pt_BR',
            siteName: 'Mont Distribuidora',
            title: titulo,
            description: descricao,
            url: caminho,
            images: [imagem ? { url: imagem, alt: titulo } : IMAGEM_LOJA],
        },
        twitter: { card: 'summary_large_image', title: titulo, description: descricao, images: [imagem ?? IMAGEM_LOJA.url] },
    }
}

export function metadadosDoProduto(p: ProdutoLoja, caminho: string): Metadata {
    return metadadosDaPagina(caminho, `${p.nome} | Mont Distribuidora`, descricaoDoProduto(p), p.imagemUrl)
}
