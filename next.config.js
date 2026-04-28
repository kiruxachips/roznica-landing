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
              "img-src 'self' data: blob: https://mc.yandex.ru https://api-maps.yandex.ru https://*.api-maps.yandex.ru https://*.maps.yandex.net https://yastatic.net https://*.yastatic.net https://millor-shop.ru https://*.userapi.com https://*.vkuserphoto.ru https://*.googleusercontent.com https://avatars.yandex.net",
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

// Sentry wrap — добавляется только если @sentry/nextjs установлен и
// SENTRY_DSN задан в env. Если источник-мапы не нужны, SENTRY_AUTH_TOKEN
// можно не задавать — ошибки всё равно трекаются, только стек минифицирован.
let finalConfig = withBundleAnalyzer(nextConfig)

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require('@sentry/nextjs')
  finalConfig = withSentryConfig(finalConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    hideSourceMaps: true,
    disableLogger: true,
    // Tunnel-route обходит adblock'и, блокирующие запросы к sentry.io.
    // Без этого теряется 20-30% клиентских ошибок.
    // Note: endpoint публичный (нужен для клиентских ошибок), но DSN
    // тоже публичный (NEXT_PUBLIC_SENTRY_DSN), так что attack-surface
    // ограничен spam'ом в dashboard. Квоты Sentry + rate-limit на их
    // стороне защищают от bill-overrun.
    tunnelRoute: '/monitoring',
    // Tree-shake тяжёлые компоненты Sentry, которые мы не используем.
    // Bundle analyzer показал sentry.client.config + 166 modules в shared
    // chunk — replay/feedback/profiling не включены в client config, но их
    // SDK-код всё равно бандлится. Эти флаги выкидывают мёртвый код.
    bundleSizeOptimizations: {
      excludeDebugStatements: true,
      excludeReplayCanvas: true,
      excludeReplayShadowDom: true,
      excludeReplayIframe: true,
      excludeReplayWorker: true,
      excludeTracing: false, // tracing мы используем (tracesSampleRate: 0.1)
    },
  })
} catch {
  // @sentry/nextjs не установлен — работаем без Sentry.
}

module.exports = finalConfig
