import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { RestoreCartClient } from "./RestoreCartClient"

export const metadata: Metadata = {
  title: "Восстанавливаем корзину | Millor Coffee",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Landing из recovery-email. Загружает AbandonedCart по токену, передаёт
 * items + promo-code клиенту, который гидрирует Zustand-стор.
 * После успешной гидрации → редирект на /cart.
 */
export default async function RestoreCartPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const sp = await searchParams
  const token = sp.token
  if (!token) notFound()

  const cart = await prisma.abandonedCart.findUnique({
    where: { recoveryToken: token },
  })
  if (!cart) notFound()

  if (cart.status === "expired" || cart.status === "recovered") {
    return (
      <main className="container mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-3">
          {cart.status === "expired" ? "Ссылка устарела" : "Корзина уже восстановлена"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {cart.status === "expired"
            ? "Скидка действовала 72 часа. Начните оформление заново."
            : "Вы уже оформили заказ по этой ссылке."}
        </p>
        <Link
          href="/catalog"
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          В каталог
        </Link>
      </main>
    )
  }

  // promoCode держали в коде письма; в Cart не гидрируем автоматически —
  // промо применяется в checkout (штатный flow валидирует).
  // Если будет желание авто-применить — можно расширить.

  const items = Array.isArray(cart.items) ? cart.items : []

  return <RestoreCartClient items={items as never} email={cart.email} />
}
