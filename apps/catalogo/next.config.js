/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@mont/shared'],
    // output: 'standalone', // re-enable for Vercel (needs symlinks, fails on Windows without admin)
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60 * 60 * 24 * 7, // 7 dias
        deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
        imageSizes: [96, 128, 180, 256, 384],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'herlvujykltxnwqmwmyx.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
}

module.exports = nextConfig
