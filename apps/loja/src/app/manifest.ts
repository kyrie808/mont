import type { MetadataRoute } from 'next'
import { TITULO_LOJA } from '@/lib/seo'

/** Ícone na tela inicial do Android (e "Adicionar à tela de início"): o símbolo da Mont em fundo creme. */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: TITULO_LOJA,
        short_name: 'Mont',
        start_url: '/',
        display: 'browser',
        background_color: '#FAF7F2',
        theme_color: '#FAF7F2',
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    }
}
