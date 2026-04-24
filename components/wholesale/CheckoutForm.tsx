"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWholesaleCart } from "@/lib/store/wholesale-cart"
import { submitWholesaleOrder } from "@/lib/actions/wholesale-orders"

interface Props {
  paymentTerms: string
  creditAvailable: number
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

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const isNetTerms = props.paymentTerms !== "prepay"
  const exceedsCredit = isNetTerms && subtotal > props.creditAvailable

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (items.length === 0) {
      setError("Корзина пуста")
      return
    }
    if (exceedsCredit) {
      setError(`Превышен кредитный лимит. Доступно: ${props.creditAvailable.toLocaleString("ru")}₽`)
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
              <p className="text-xs text-muted-foreground mt-1.5">
                Транспортную компанию и тариф согласуем с менеджером отдельно.
              </p>
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
          <span className="text-muted-foreground">Условия оплаты</span>
          <span className="font-medium">
            {props.paymentTerms === "prepay"
              ? "Предоплата"
              : `Отсрочка ${props.paymentTerms.replace("net", "")} дн.`}
          </span>
        </div>
        {isNetTerms && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Свободный кредит</span>
            <span className={exceedsCredit ? "text-red-600 font-medium" : ""}>
              {props.creditAvailable.toLocaleString("ru")}₽
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold pt-2 border-t">
          <span>К оплате</span>
          <span>{subtotal.toLocaleString("ru")}₽</span>
        </div>
        <button
          type="submit"
          disabled={loading || exceedsCredit}
          className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Отправляем..." : isNetTerms ? "Отправить на одобрение" : "Оформить заказ"}
        </button>
        {isNetTerms && (
          <p className="text-xs text-muted-foreground">
            Заказ уйдёт менеджеру на подтверждение. После одобрения мы подготовим счёт.
          </p>
        )}
      </aside>
    </form>
  )
}
