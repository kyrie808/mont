import type { MetadataRoute } from 'next'
import { catalogoDa } from '@/lib/sacola/calculo'
import { DOMINIO_FINAL } from '@/lib/seo'
import { carregarVitrine } from '@/lib/vitrine/carregar'

/**
 * Home + cada produto à venda + cada combo na vitrine (os da campanha só enquanto ela está ativa).
 * Sai do cadastro a cada leitura: produto novo ou escondido no sistema interno entra ou sai sozinho.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const catalogo = catalogoDa(await carregarVitrine())
    const url = (caminho: string) => new URL(caminho, DOMINIO_FINAL).toString()
    return [
        { url: url('/'), changeFrequency: 'daily', priority: 1 },
        ...[...catalogo.produtos.values()].map((p) => ({ url: url(`/produto/${p.slug}`), changeFrequency: 'weekly' as const, priority: 0.8 })),
        ...[...catalogo.combos.values()].map((c) => ({ url: url(`/combo/${c.slug}`), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ]
}
