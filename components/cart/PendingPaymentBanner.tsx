"use client"

import { useEffect, useState } from "react"
import { CreditCard, X, Clock } from "lucide-react"
import {
  usePendingPaymentStore,
  subscribeOrderResolved,
} from "@/lib/store/pending-payment"

/**
 * I5 (B-1): баннер «Завершите оплату» на /cart, /thank-you, мобильном
 * меню и любых страницах, где юзер может вернуться после abandoned-pay.
 *
 * При mount:
 *   1. Если store пустой — ничего не рисуем.
 *   2. Иначе fetch /api/orders/check-pending?orderNumber=...&trackingToken=...
 *      → если status≠pending → clear() и скрываемся.
 *      → если pending — показываем кнопку «Доплатить» с paymentUrl из ответа
 *        (свежим, не из store). Если url истёк (status=expired) — кнопка
 *        «Создать новую ссылку» (B-2; в B-1 пока просто disabled).
 *
 * BroadcastChannel: если другая вкладка получила payment_succeeded →
 * subscribeOrderResolved очистит и скроет банер.
 */
export function PendingPaymentBanner() {
  const current = usePendingPaymentStore((s) => s.current)
  const setPending = usePendingPaymentStore((s) => s.setPending)
  const clear = usePendingPaymentStore((s) => s.clear)
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [repaying, setRepaying] = useState(false)
  const [repayError, setRepayError] = useState<string | null>(null)

  // Cross-tab: если оплатили на другой вкладке, тут банер исчезает.
  useEffect(() => {
    if (!current) return
    const unsub = subscribeOrderResolved((orderId) => {
      if (orderId === current.orderId) clear()
    })
    return unsub
  }, [current, clear])

  // Server-side check: статус заказа + свежий paymentUrl.
  useEffect(() => {
    if (!current) {
      setLoading(false)
      return
    }
    let cancelled = false
    const params = new URLSearchParams({
      orderNumber: current.orderNumber,
      trackingToken: current.trackingToken,
    })
    fetch(`/api/orders/check-pending?${params}`)
      .then((r) => r.json())
      .then((data: { status: string; paymentUrl: string | null }) => {
        if (cancelled) return
        if (data.status === "paid" || data.status === "cancelled") {
          // Заказ оплачен / отменён — снимаем баннер навсегда.
          clear()
          return
        }
        if (data.status === "not-found") {
          // Token не сошёлся / orderNumber невалиден — мусор в store.
          clear()
          return
        }
        if (data.status === "expired") {
          setExpired(true)
          setFreshUrl(null)
        } else if (data.status === "pending" && data.paymentUrl) {
          setExpired(false)
          setFreshUrl(data.paymentUrl)
        }
      })
      .catch(() => {
        // Сеть упала — оставляем store как есть, но не показываем кнопку,
        // чтобы юзер не попал на возможно-протухшую ссылку.
        setExpired(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [current, clear])

  if (!current || loading || (!freshUrl && !expired)) return null

  const minutesLeft = Math.max(
    0,
    Math.floor((current.expiresAt - Date.now()) / 60000)
  )

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 sm:p-5 mb-4">
      <div className="flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-amber-900">
            Завершите оплату заказа {current.orderNumber}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            На сумму{" "}
            <span className="font-semibold">{current.amount}₽</span>.{" "}
            {expired
              ? "Ссылка для оплаты устарела — создадим новую."
              : minutesLeft > 0
                ? `Ссылка действительна ещё ~${minutesLeft} мин.`
                : "Ссылка скоро истечёт."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          aria-label="Скрыть напоминание"
          className="shrink-0 w-9 h-9 -mr-1 -mt-1 flex items-center justify-center rounded-md text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        {expired ? (
          <button
            type="button"
            disabled={repaying}
            onClick={async () => {
              if (!current) return
              setRepaying(true)
              setRepayError(null)
              try {
                const r = await fetch("/api/orders/repay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderId: current.orderId,
                    trackingToken: current.trackingToken,
                  }),
                })
                if (!r.ok) {
                  const data = await r.json().catch(() => ({}))
                  if (data?.error === "cancelled" || data?.error === "already_paid") {
                    // Серверный статус говорит, что банер больше не нужен.
                    clear()
                    return
                  }
                  throw new Error(data?.error || "Не удалось создать ссылку")
                }
                const data: { paymentUrl: string; expiresAt: number } =
                  await r.json()
                // Обновляем store: новый URL + новое expiresAt — и сразу
                // редирект пользователя на платёж.
                setPending({
                  ...current,
                  paymentUrl: data.paymentUrl,
                  expiresAt: data.expiresAt,
                })
                window.location.href = data.paymentUrl
              } catch (e) {
                setRepayError(
                  e instanceof Error ? e.message : "Попробуйте ещё раз"
                )
                setRepaying(false)
              }
            }}
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" />
            {repaying ? "Создаём ссылку…" : "Создать новую ссылку оплаты"}
          </button>
        ) : freshUrl ? (
          <a
            href={freshUrl}
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Доплатить — {current.amount}₽
          </a>
        ) : null}
      </div>

      {repayError && (
        <p className="mt-2 text-xs text-red-700">{repayError}</p>
      )}
    </div>
  )
}
