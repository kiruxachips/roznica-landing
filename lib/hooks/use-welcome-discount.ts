"use client"

import { useEffect, useState } from "react"

export interface WelcomeDiscount {
  discount: number
  percent: number
}

/**
 * Тянет welcome-скидку с backend для текущего subtotal. Эндпоинт
 * учитывает eligibility пользователя (firstOrderCompletedAt) и settings.
 *
 * Используется и в OrderSummary (для рендера строки «Первый заказ −10%»),
 * и в useDeliveryRates (нужно для cartTotal, по которому сервер выбирает
 * правило бесплатной доставки — иначе будет рассинхрон с createOrder).
 */
export function useWelcomeDiscount(subtotal: number): WelcomeDiscount | null {
  const [welcome, setWelcome] = useState<WelcomeDiscount | null>(null)
  useEffect(() => {
    if (subtotal <= 0) {
      setWelcome(null)
      return
    }
    const ctrl = new AbortController()
    fetch(`/api/cart/welcome-discount?subtotal=${subtotal}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.eligible && d.discount > 0) {
          setWelcome({ discount: d.discount, percent: d.percent })
        } else {
          setWelcome(null)
        }
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [subtotal])
  return welcome
}
