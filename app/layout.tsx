import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Свежеобжаренный кофе с доставкой | Millor Coffee",
  description: "Премиальный кофе свежей обжарки из лучших плантаций мира. Обжариваем под заказ, доставляем по всей России. Бесплатная доставка от 3000₽.",
  keywords: ["кофе", "свежеобжаренный кофе", "кофе в зёрнах", "премиальный кофе", "купить кофе"],
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Свежеобжаренный кофе с доставкой | Millor Coffee",
    description: "Премиальный кофе свежей обжарки из лучших плантаций мира",
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
        {children}
      </body>
    </html>
  )
}
