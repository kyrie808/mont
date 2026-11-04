import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    transpilePackages: ['@mont/shared'],
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'herlvujykltxnwqmwmyx.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
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
