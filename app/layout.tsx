import "@/lib/env" // Validate critical env vars on startup
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { CookieBanner } from "@/components/ui/cookie-banner"
import { Analytics } from "@/components/ui/analytics"
import { BottomNav } from "@/components/layout/BottomNav"
import { WebVitals } from "@/components/ui/web-vitals"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
})


export const metadata: Metadata = {
  metadataBase: new URL("https://millor-coffee.ru"),
  title: "Купить свежеобжаренный кофе для дома с доставкой | Millor Coffee",
  description: "Свежеобжаренный кофе в зёрнах для дома. Обжариваем под заказ, отправляем на следующий день. Бесплатная доставка по России от 3000₽. Попробуйте настоящий specialty!",
  keywords: ["купить кофе для дома", "свежеобжаренный кофе с доставкой", "кофе в зёрнах для дома", "кофе с доставкой на дом", "попробовать кофе", "кофе в подарок"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "AZ6UoMy6btdeWcT8Dvev1-JuxSCkB2xsBI_nURpAOo0",
    yandex: process.env.YANDEX_VERIFICATION,
  },
  openGraph: {
    title: "Купить свежеобжаренный кофе для дома с доставкой | Millor Coffee",
    description: "Свежеобжаренный кофе в зёрнах для дома. Обжариваем под заказ, отправляем на следующий день. Попробуйте настоящий specialty!",
    type: "website",
    locale: "ru_RU",
    siteName: "Millor Coffee",
    url: "https://millor-coffee.ru",
  },
  twitter: {
    card: "summary_large_image",
    title: "Купить свежеобжаренный кофе для дома с доставкой | Millor Coffee",
    description: "Свежеобжаренный кофе в зёрнах для дома. Обжариваем под заказ, отправляем на следующий день. Попробуйте настоящий specialty!",
  },
  alternates: {
    canonical: "/",
  },
}

// UX1: явный viewport — Next 15 требует отдельный export. maximum-scale=5
// разрешает pinch-zoom (a11y), viewport-fit=cover — корректная работа с
// safe-area-inset на iPhone X+.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://mc.yandex.ru" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api-maps.yandex.ru" />
        <link rel="dns-prefetch" href="https://yastatic.net" />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Millor Coffee",
                url: "https://millor-coffee.ru",
                logo: "https://millor-coffee.ru/apple-touch-icon.png",
                description: "Свежеобжаренный кофе в зёрнах для дома с доставкой по России",
                contactPoint: {
                  "@type": "ContactPoint",
                  email: "sales@millor-coffee.ru",
                  contactType: "customer service",
                  availableLanguage: "Russian",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Millor Coffee",
                url: "https://millor-coffee.ru",
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: "https://millor-coffee.ru/blog?search={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
          }}
        />
        {children}
        <BottomNav />
        <CookieBanner />
        <Analytics />
        <WebVitals />
      </body>
    </html>
  )
}
