import type { MetadataRoute } from 'next'
import { DOMINIO_FINAL } from '@/lib/seo'

/** A loja liberada para os buscadores; sacola e checkout fora (também têm noindex). */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/sacola', '/checkout'] },
        sitemap: `${DOMINIO_FINAL}/sitemap.xml`,
    }
}
