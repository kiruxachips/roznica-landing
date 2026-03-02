import type { Metadata } from "next"
import { CookieBanner } from "@/components/ui/cookie-banner"
import { Analytics } from "@/components/ui/analytics"
import { SessionProvider } from "@/components/providers/SessionProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: "Купить свежеобжаренный кофе для дома с доставкой | Millor Coffee",
  description: "Свежеобжаренный кофе в зёрнах для дома. Обжариваем под заказ, отправляем на следующий день. Бесплатная доставка по России от 3000₽. Попробуйте настоящий specialty!",
  keywords: ["купить кофе для дома", "свежеобжаренный кофе с доставкой", "кофе в зёрнах для дома", "кофе с доставкой на дом", "попробовать кофе", "кофе в подарок"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Купить свежеобжаренный кофе для дома с доставкой | Millor Coffee",
    description: "Свежеобжаренный кофе в зёрнах для дома. Обжариваем под заказ, отправляем на следующий день. Попробуйте настоящий specialty!",
    type: "website",
    locale: "ru_RU",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <SessionProvider>
        {children}
        </SessionProvider>
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  )
}
