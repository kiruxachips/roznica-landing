"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { createOrder } from "@/lib/actions/orders"
import { GiftPicker } from "../GiftPicker"

interface UnavailableItem {
  variantId: string
  name: string
  available: number
  requested: number
  reason: string
  currentPrice?: number
}

export function PaymentStep({ finalTotal }: { finalTotal: number }) {
  const router = useRouter()
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const clearCart = useCartStore((s) => s.clearCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const updatePrice = useCartStore((s) => s.updatePrice)

  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)
  const deliveryCity = useDeliveryStore((s) => s.city)
  const deliveryCityCode = useDeliveryStore((s) => s.cityCode)
  const deliveryPostalCode = useDeliveryStore((s) => s.postalCode)
  const resetDelivery = useDeliveryStore((s) => s.reset)

  const contact = useCheckoutWizard((s) => s.contact)
  const notes = useCheckoutWizard((s) => s.notes)
  const setNotes = useCheckoutWizard((s) => s.setNotes)
  const agreed = useCheckoutWizard((s) => s.agreed)
  const setAgreed = useCheckoutWizard((s) => s.setAgreed)
  const setStep = useCheckoutWizard((s) => s.setStep)
  const resetWizard = useCheckoutWizard((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null)
  const [unavailableItems, setUnavailableItems] = useState<UnavailableItem[]>([])

  const afterDiscount = totalPrice() - promoDiscount
  const deliveryPrice = selectedRate ? selectedRate.priceWithMarkup : 0

  async function handleSubmit() {
    // Защита на случай программного dispatchEvent из sticky bar или от
    // сторонних скриптов — `disabled` на кнопке не гарантирует, что код
    // сюда не зайдёт.
    if (!agreed) {
      setError("Подтвердите согласие с политикой и офертой, чтобы продолжить")
      return
    }
    if (!selectedRate) {
      setError("Выберите способ доставки на предыдущем шаге")
      return
    }
    if (loading) return

    setLoading(true)
    setError("")
    try {
      const rawAddress = doorAddress || ""
      const fullDoorAddress =
        deliveryCity && rawAddress ? `${deliveryCity}, ${rawAddress}` : rawAddress || undefined
      const address =
        selectedRate?.deliveryType === "pvz" && selectedPickupPoint
          ? `ПВЗ: ${selectedPickupPoint.name}, ${selectedPickupPoint.address}`
          : fullDoorAddress

      const result = await createOrder({
        customerName: `${contact.lastName.trim()} ${contact.firstName.trim()}`.trim(),
        customerEmail: contact.email.trim() || undefined,
        customerPhone: contact.phone,
        deliveryAddress: address,
        deliveryMethod: selectedRate?.carrier || undefined,
        paymentMethod: "online",
        notes: notes.trim() || undefined,
        promoCode: promoCode || undefined,
        deliveryType: selectedRate?.deliveryType,
        deliveryPrice,
        pickupPointCode: selectedPickupPoint?.code,
        pickupPointName: selectedPickupPoint
          ? `${selectedPickupPoint.name}, ${selectedPickupPoint.address}`
          : undefined,
        destinationCity: deliveryCity || undefined,
        destinationCityCode: deliveryCityCode || undefined,
        estimatedDelivery: selectedRate
          ? `${selectedRate.minDays}-${selectedRate.maxDays} дн.`
          : undefined,
        tariffCode: selectedRate?.tariffCode,
        postalCode: deliveryPostalCode || undefined,
        selectedGiftId,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          weight: item.weight,
          price: item.price,
          quantity: item.quantity,
        })),
      })

      if (!result.success) {
        if (result.unavailableItems && result.unavailableItems.length > 0) {
          setUnavailableItems(result.unavailableItems)
          setLoading(false)
          return
        }
        setError(result.error)
        setLoading(false)
        return
      }

      clearCart()
      resetDelivery()
      resetWizard()

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
      } else {
        const url = `/thank-you?order=${result.orderNumber}${
          result.thankYouToken ? `&token=${result.thankYouToken}` : ""
        }`
        router.push(url)
      }

      // Safety-net: если по какой-то причине редирект не сработал
      // (блокировка popup, ошибка роутера), через 5 секунд вернём кнопку
      // в активное состояние, чтобы юзер не был заперт в "Оформление…".
      setTimeout(() => setLoading(false), 5000)
    } catch (e) {
      console.error("Checkout submit failed:", e)
      const msg = e instanceof Error ? e.message : "Попробуйте ещё раз"
      setError(`Ошибка при оформлении заказа: ${msg}`)
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Оплата и подтверждение</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Способ оплаты, комментарий к заказу и согласие
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Способ оплаты</label>
        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
          <Lock className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="font-medium text-sm">Онлайн-оплата</p>
            <p className="text-xs text-muted-foreground">
              Банковская карта, СБП, ЮMoney — безопасно через ЮKassa
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий к заказу</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Пожелания курьеру, время доставки и т.п."
        />
      </div>

      <GiftPicker
        cartTotal={afterDiscount}
        value={selectedGiftId}
        onChange={setSelectedGiftId}
      />

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input accent-primary"
        />
        <span className="text-sm text-muted-foreground">
          Я соглашаюсь с{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Политикой конфиденциальности
          </Link>{" "}
          и{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Пользовательским соглашением
          </Link>
        </span>
      </label>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          onClick={() => setStep("delivery")}
          className="h-12 px-5 border border-border rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <button
          type="button"
          id="checkout-submit"
          onClick={handleSubmit}
          disabled={loading || !agreed}
          className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? "Оформление..." : `Оплатить — ${finalTotal}₽`}
        </button>
      </div>

      {unavailableItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Товары изменили статус</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Пока вы оформляли заказ, эти товары стали недоступны или изменились в цене.
              Мы не можем оформить заказ, пока они в корзине.
            </p>
            <ul className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {unavailableItems.map((u) => (
                <li key={u.variantId} className="text-sm bg-amber-50 rounded-xl px-3 py-2">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-amber-700">
                    {u.reason === "out_of_stock" && "Нет в наличии"}
                    {u.reason === "insufficient_stock" &&
                      `Доступно только ${u.available} из запрошенных ${u.requested}`}
                    {u.reason === "inactive" && "Товар снят с продажи"}
                    {u.reason === "price_changed" && u.currentPrice !== undefined
                      ? `Цена изменилась, актуальная — ${u.currentPrice}₽`
                      : u.reason === "price_changed" && "Цена изменилась"}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              {unavailableItems.every(
                (u) => u.reason === "price_changed" && u.currentPrice !== undefined
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    for (const u of unavailableItems) {
                      if (u.currentPrice !== undefined) updatePrice(u.variantId, u.currentPrice)
                    }
                    setUnavailableItems([])
                  }}
                  className="h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Обновить цены и продолжить
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  for (const u of unavailableItems) removeItem(u.variantId)
                  setUnavailableItems([])
                }}
                className="h-11 border border-primary text-primary rounded-xl text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                Убрать из корзины и продолжить
              </button>
              <button
                type="button"
                onClick={() => setUnavailableItems([])}
                className="h-11 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
              >
                Отменить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
