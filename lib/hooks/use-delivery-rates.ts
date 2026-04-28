"use client"

import { useEffect } from "react"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCartStore } from "@/lib/store/cart"
import { useWelcomeDiscount } from "@/lib/hooks/use-welcome-discount"

/**
 * Пересчитывает тарифы доставки при изменении города или состава корзины.
 * Раньше жил внутри CitySearch, но тот компонент монтируется только на
 * шаге «Доставка». Если корзина мутирует на шаге «Оплата» (модалка
 * unavailableItems → удаление товара / правка цены), пересчёта не было —
 * selectedRate.priceWithMarkup застывал от прежнего состава, и мог
 * показывать «бесплатно» при сумме ниже порога.
 *
 * Хук монтируется в CheckoutForm (root), реагирует на cityCode/postalCode/
 * cartTotal/itemsKey независимо от текущего шага мастера.
 */
export function useDeliveryRates() {
  const cityCode = useDeliveryStore((s) => s.cityCode)
  const postalCode = useDeliveryStore((s) => s.postalCode)
  const city = useDeliveryStore((s) => s.city)
  const region = useDeliveryStore((s) => s.region)
  const setRates = useDeliveryStore((s) => s.setRates)
  const setRatesLoading = useDeliveryStore((s) => s.setRatesLoading)
  const setRatesError = useDeliveryStore((s) => s.setRatesError)
  const selectRate = useDeliveryStore((s) => s.selectRate)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)

  const subtotal = useCartStore((s) => s.totalPrice)()
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const cartItems = useCartStore((s) => s.items)
  const itemsForPacking = useCartStore((s) => s.itemsForPacking)()

  // Сервер в createOrder передаёт в calculateDeliveryRates тот же cartTotal:
  // subtotal минус промокод (если есть) минус списанные бонусы. Welcome-
  // скидка в порог НЕ вычитается — иначе пользователь видит подытог 3005₽,
  // ожидает «бесплатно от 3000₽», но welcome -10% опускает базу под порог.
  // Промокод/бонусы — явные действия пользователя, их учитываем.
  //
  // C7: useWelcomeDiscount всё равно дёргаем (нужен .loading) — он же
  // используется в OrderSummary для UI-разметки. Если убрать — будет 2
  // независимых fetch'а на /api/cart/welcome-discount.
  const welcome = useWelcomeDiscount(subtotal)
  const cartTotal = Math.max(0, subtotal - promoDiscount)
  // Стабильная строка-ключ — массив каждый рендер новый, без хэша
  // useEffect зацикливался бы.
  const itemsKey = cartItems
    .map((i) => `${i.variantId}:${i.quantity}:${i.weight}`)
    .join("|")

  useEffect(() => {
    if (!cityCode && !postalCode) return
    // C7: не запускаем fetch пока welcome ещё в процессе загрузки —
    // иначе cartTotal будет = subtotal без скидки, а после загрузки
    // получится refetch с другим cartTotal и потенциально другой ценой.
    if (welcome.loading) return

    setRatesLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch("/api/delivery/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityCode: cityCode || undefined,
          postalCode: postalCode || undefined,
          city: city || undefined,
          region: region || undefined,
          cartTotal,
          items: itemsForPacking,
        }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rates) => {
          setRates(rates)
          setRatesLoading(false)
          if (rates.length === 0) return
          // Если выбранный ранее тариф (carrier+tariffCode) ещё в выдаче —
          // сохраняем выбор, но обновляем priceWithMarkup. Иначе — авто
          // на самый дешёвый.
          const current = selectedRate
          const match =
            current &&
            rates.find(
              (r: { carrier: string; tariffCode: number }) =>
                r.carrier === current.carrier && r.tariffCode === current.tariffCode
            )
          selectRate(match || rates[0])
        })
        .catch((e) => {
          if (e?.name === "AbortError") return
          setRatesError("Не удалось рассчитать стоимость доставки")
          setRatesLoading(false)
        })
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // city/region/itemsForPacking опущены: cityCode — уникальный идентификатор,
    // itemsKey — стабильный хэш состава. selectedRate в deps вызвал бы
    // бесконечный рефетч (хук сам же его обновляет через selectRate).
    // welcome.loading — нужен, чтобы дёрнуть refetch после первой загрузки скидки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCode, postalCode, cartTotal, itemsKey, welcome.loading])
}
