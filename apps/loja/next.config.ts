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
}

export default nextConfig
