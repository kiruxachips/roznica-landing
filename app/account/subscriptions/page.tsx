import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SubscriptionActions } from "@/components/account/SubscriptionActions"

export const metadata: Metadata = {
  title: "Подписки | Millor Coffee",
}

export const dynamic = "force-dynamic"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login?next=/account/subscriptions")

  const subs = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: [{ status: "asc" }, { nextDeliveryDate: "asc" }],
    include: {
      variant: {
        select: {
          weight: true,
          price: true,
          product: { select: { name: true, slug: true, smallImage: true } },
        },
      },
    },
  })

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-sans font-bold mb-5">Подписки</h1>

      {subs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-muted-foreground mb-3">У вас пока нет активных подписок</p>
          <p className="text-sm text-muted-foreground mb-5">
            Получайте свежеобжаренный кофе каждые 2-4 недели со скидкой 5%. Подписка
            оформляется на любой товар из каталога.
          </p>
          <Link
            href="/catalog"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            В каталог
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {subs.map((s) => {
            const isActive = s.status === "active"
            const isPaused = s.status === "paused"
            const isCancelled = s.status === "cancelled"
            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl shadow-sm p-4 ${
                  isCancelled ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">
                        <Link
                          href={`/catalog/${s.variant.product.slug}`}
                          className="hover:text-primary"
                        >
                          {s.variant.product.name}
                        </Link>
                      </h3>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase">
                          активна
                        </span>
                      )}
                      {isPaused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold uppercase">
                          пауза
                        </span>
                      )}
                      {isCancelled && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold uppercase">
                          отменена
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.variant.weight} × {s.quantity} шт. · каждые {s.intervalDays} дней
                      · скидка {s.discountPercent}%
                    </p>
                    {!isCancelled && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Следующая доставка:{" "}
                        <strong>
                          {new Date(s.nextDeliveryDate).toLocaleDateString("ru-RU")}
                        </strong>
                        {isPaused && s.pausedUntil && (
                          <> · до {new Date(s.pausedUntil).toLocaleDateString("ru-RU")}</>
                        )}
                      </p>
                    )}
                  </div>
                  {!isCancelled && (
                    <SubscriptionActions
                      subscriptionId={s.id}
                      status={s.status as "active" | "paused"}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
