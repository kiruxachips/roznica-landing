/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'millor-shop.ru',
      },
    ],
  },
  serverExternalPackages: ['sharp'],
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://api-maps.yandex.ru https://*.api-maps.yandex.ru https://yastatic.net https://*.yastatic.net https://telegram.org",
              "style-src 'self' 'unsafe-inline' https://api-maps.yandex.ru https://*.api-maps.yandex.ru https://yastatic.net https://*.yastatic.net",
              "img-src 'self' data: blob: https://mc.yandex.ru https://api-maps.yandex.ru https://*.api-maps.yandex.ru https://*.maps.yandex.net https://yastatic.net https://*.yastatic.net https://millor-shop.ru",
              "font-src 'self' data:",
              "connect-src 'self' https://mc.yandex.ru https://api-maps.yandex.ru https://*.api-maps.yandex.ru https://*.maps.yandex.net https://geocode-maps.yandex.ru https://yastatic.net https://*.yastatic.net",
              "frame-src https://yoomoney.ru https://telegram.org",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
