import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    transpilePackages: ['@mont/shared'],
    // Sem /_next/image (a cota de Image Optimization da Vercel acabou em 12/11/2026 e as fotos ficaram em
    // branco): o loader aponta para as versões leves fixas do bucket (src/lib/imagem/variantes.ts).
    // As duas larguras do srcset são as duas versões: 200 (miniatura) e 800.
    images: {
        loader: 'custom',
        loaderFile: './src/lib/imagem/loader.ts',
        imageSizes: [200],
        deviceSizes: [800],
    },
    // Links do catálogo antigo (www.montdistribuidora.com.br), prontos antes da troca de domínio.
    // Permanentes (308): o Google passa a guardar o endereço novo.
    async redirects() {
        return [
            { source: '/produtos', destination: '/', permanent: true },
            { source: '/produtos/:slug', destination: '/produto/:slug', permanent: true },
            { source: '/carrinho', destination: '/sacola', permanent: true },
            { source: '/sobre', destination: '/#quem-somos', permanent: true },
            { source: '/admin', destination: 'https://sistema.montdistribuidora.com.br', permanent: true },
            { source: '/admin/:caminho*', destination: 'https://sistema.montdistribuidora.com.br', permanent: true },
        ]
    },
}

export default nextConfig
