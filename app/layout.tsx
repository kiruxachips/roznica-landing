import type { Metadata } from "next"
import Script from "next/script"
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
        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
              m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
              m[i].l=1*new Date();
              for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
              k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=106584393', 'ym');

            ym(106584393, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/106584393" style={{position: 'absolute', left: '-9999px'}} alt="" />
          </div>
        </noscript>
      </body>
    </html>
  )
}
