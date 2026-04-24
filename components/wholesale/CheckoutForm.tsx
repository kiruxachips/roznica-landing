"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useWholesaleCart } from "@/lib/store/wholesale-cart"
import { submitWholesaleOrder, getCartTierPreview } from "@/lib/actions/wholesale-orders"
import { WholesaleDeliveryPicker, type DeliveryPickerValue } from "./DeliveryPicker"

function parseWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const m = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!m) return 0
  const n = parseFloat(m[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = m[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}

interface TierState {
  applied: { minWeightGrams: number; discountPct: number } | null
  discountPct: number
}

interface Props {
  defaultAddress: string
  defaultPhone: string
  defaultName: string
  companyLegalName: string
  companyInn: string
  companyKpp: string | null
}

export function WholesaleCheckout(props: Props) {
  const router = useRouter()
  const items = useWholesaleCart((s) => s.items)
  const clearCart = useWholesaleCart((s) => s.clearCart)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const [delivery, setDelivery] = useState<DeliveryPickerValue>({
    city: "",
    postalCode: "",
    selected: null,
  })
  const itemsForPacking = useMemo(
    () =>
      items
        .map((i) => ({ weightGrams: parseWeightGrams(i.weight), quantity: i.quantity }))
        .filter((i) => i.weightGrams > 0 && i.quantity > 0),
    [items]
  )
  const totalWeightGrams = itemsForPacking.reduce(
    (s, i) => s + i.weightGrams * i.quantity,
    0
  )

  const [tier, setTier] = useState<TierState>({ applied: null, discountPct: 0 })
  useEffect(() => {
    if (items.length === 0) return
    getCartTierPreview(totalWeightGrams)
      .then((data) => setTier({ applied: data.applied, discountPct: data.discountPct }))
      .catch(() => {})
  }, [totalWeightGrams, items.length])

  const gross = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const tierDiscount = Math.round((gross * tier.discountPct) / 100)
  const subtotal = gross - tierDiscount
  const deliveryPrice = delivery.selected?.priceWithMarkup ?? 0
  const total = subtotal + deliveryPrice

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (items.length === 0) {
      setError("Корзина пуста")
      return
    }
    if (!delivery.selected) {
      setError("Выберите тариф доставки")
      return
    }
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)

    try {
      const result = await submitWholesaleOrder({
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          name: i.name,
          weight: i.weight,
          quantity: i.quantity,
        })),
        deliveryAddress: String(form.get("deliveryAddress") || ""),
        contactName: String(form.get("contactName") || ""),
        contactPhone: String(form.get("contactPhone") || ""),
        notes: String(form.get("notes") || "") || undefined,
        deliveryMethod: delivery.selected.carrier,
        deliveryType: delivery.selected.type,
        destinationCity: delivery.city,
        postalCode: delivery.postalCode,
        estimatedDelivery: delivery.selected.estimatedDays,
        tariffCode: delivery.selected.tariffCode,
      })

      if (!result.success) {
        setError("Некоторые товары больше недоступны. Обновите корзину.")
        setLoading(false)
        return
      }

      clearCart()
      router.push(`/wholesale/checkout/success?order=${result.orderNumber}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось оформить заказ")
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
        <p className="text-muted-foreground">Корзина пуста. Вернитесь в каталог.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-5">
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold">Реквизиты</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs mb-0.5">Плательщик</div>
              <div className="font-medium">{props.companyLegalName}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs mb-0.5">ИНН / КПП</div>
              <div className="font-medium">
                {props.companyInn}
                {props.companyKpp ? ` / ${props.companyKpp}` : ""}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Реквизиты берутся из профиля компании. Изменить — свяжитесь с менеджером.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold">Контакт и доставка</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Контактное лицо</label>
              <input
                name="contactName"
                required
                defaultValue={props.defaultName}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Телефон</label>
              <input
                name="contactPhone"
                required
                type="tel"
                defaultValue={props.defaultPhone}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Адрес доставки</label>
              <textarea
                name="deliveryAddress"
                required
                rows={2}
                defaultValue={props.defaultAddress}
                placeholder="Город, улица, здание, офис"
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="sm:col-span-2">
              <WholesaleDeliveryPicker
                items={itemsForPacking}
                cartTotal={subtotal}
                onChange={setDelivery}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">
                Комментарий <span className="text-muted-foreground">(необязательно)</span>
              </label>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <h2 className="font-semibold">Итого</h2>
        <div className="space-y-1.5 text-sm max-h-60 overflow-y-auto">
          {items.map((i) => (
            <div key={i.variantId} className="flex justify-between gap-2">
              <span className="min-w-0">
                <span className="truncate block font-medium">{i.name}</span>
                <span className="text-xs text-muted-foreground">
                  {i.weight} × {i.quantity}
                </span>
              </span>
              <span className="shrink-0 font-medium">{(i.quantity * i.unitPrice).toLocaleString("ru")}₽</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm pt-2 border-t">
          <span className="text-muted-foreground">Товары</span>
          <span>{gross.toLocaleString("ru")}₽</span>
        </div>
        {tierDiscount > 0 && (
          <div className="flex justify-between text-sm text-primary">
            <span>Скидка {tier.discountPct}% (от {((tier.applied?.minWeightGrams ?? 0) / 1000).toFixed(0)} кг)</span>
            <span className="font-medium">−{tierDiscount.toLocaleString("ru")}₽</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Доставка</span>
          <span>
            {delivery.selected
              ? `${deliveryPrice.toLocaleString("ru")}₽`
              : "выберите тариф"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Оплата</span>
          <span className="font-medium">По счёту (100% предоплата)</span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>Итого в счёт</span>
          <span>{total.toLocaleString("ru")}₽</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Отправляем..." : "Отправить заявку менеджеру"}
        </button>
        <p className="text-xs text-muted-foreground">
          После подтверждения менеджером вы получите PDF-счёт на оплату. Товар
          зарезервируется, пока менеджер рассматривает заявку.
        </p>
      </aside>
    </form>
  )
}
