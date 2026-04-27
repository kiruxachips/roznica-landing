"use client"

import { useEffect, useState } from "react"

export interface WelcomeDiscount {
  discount: number
  percent: number
}

export interface WelcomeDiscountState {
  /** Скидка ещё не запрошена / запрос в полёте. Потребители (useDeliveryRates)
   *  должны дождаться loading=false перед расчётом cartTotal — иначе серверная
   *  и клиентская формулы разойдутся, и правило «бесплатно от X₽» сработает
   *  у клиента, но не у сервера. */
  loading: boolean
  value: WelcomeDiscount | null
}

/**
 * Тянет welcome-скидку с backend для текущего subtotal. Эндпоинт
 * учитывает eligibility пользователя (firstOrderCompletedAt) и settings.
 *
 * Используется и в OrderSummary (для рендера строки «Первый заказ −10%»),
 * и в useDeliveryRates (нужно для cartTotal, по которому сервер выбирает
 * правило бесплатной доставки — иначе будет рассинхрон с createOrder).
 */
export function useWelcomeDiscount(subtotal: number): WelcomeDiscountState {
  // Стартуем с loading=true для subtotal>0, чтобы потребители не побежали
  // считать с заведомо неправильным значением (welcome=null до первого fetch).
  const [state, setState] = useState<WelcomeDiscountState>({
    loading: subtotal > 0,
    value: null,
  })
  useEffect(() => {
    if (subtotal <= 0) {
      setState({ loading: false, value: null })
      return
    }
    setState((prev) => ({ ...prev, loading: true }))
    const ctrl = new AbortController()
    fetch(`/api/cart/welcome-discount?subtotal=${subtotal}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.eligible && d.discount > 0) {
          setState({ loading: false, value: { discount: d.discount, percent: d.percent } })
        } else {
          setState({ loading: false, value: null })
        }
      })
      .catch((e) => {
        if (e?.name === "AbortError") return
        setState({ loading: false, value: null })
      })
    return () => ctrl.abort()
  }, [subtotal])
  return state
}
