/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://mc.yandex.ru https://api-maps.yandex.ru https://yastatic.net https://telegram.org",
              "style-src 'self' 'unsafe-inline' https://api-maps.yandex.ru https://yastatic.net",
              "img-src 'self' data: blob: https://mc.yandex.ru https://api-maps.yandex.ru https://yastatic.net https://millor-shop.ru",
              "font-src 'self' data:",
              "connect-src 'self' https://mc.yandex.ru https://api-maps.yandex.ru https://yastatic.net",
              "frame-src https://yoomoney.ru https://telegram.org",
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

module.exports = nextConfig
