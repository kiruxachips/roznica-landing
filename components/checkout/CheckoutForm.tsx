"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { useCartStore } from "@/lib/store/cart"
import { createOrder } from "@/lib/actions/orders"

interface UserProfile {
  name: string | null
  email: string | null
  phone: string | null
  defaultAddress: string | null
}

export function CheckoutForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const clearCart = useCartStore((s) => s.clearCart)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  useEffect(() => setMounted(true), [])

  // Fetch profile data for auto-fill
  useEffect(() => {
    if (!isCustomer || !session?.user?.id) return

    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setProfile(data))
      .catch(() => {})
  }, [isCustomer, session?.user?.id])

  if (!mounted) return null

  const total = totalPrice()
  const afterDiscount = total - promoDiscount
  const deliveryPrice = afterDiscount >= 3000 ? 0 : 300
  const finalTotal = afterDiscount + deliveryPrice

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted-foreground mb-4">Корзина пуста</p>
        <Link href="/catalog" className="text-primary hover:underline">Перейти в каталог</Link>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = new FormData(e.currentTarget)

    try {
      const result = await createOrder({
        customerName: form.get("name") as string,
        customerEmail: (form.get("email") as string) || undefined,
        customerPhone: form.get("phone") as string,
        deliveryAddress: (form.get("address") as string) || undefined,
        deliveryMethod: (form.get("delivery") as string) || undefined,
        notes: (form.get("notes") as string) || undefined,
        promoCode: promoCode || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          weight: item.weight,
          price: item.price,
          quantity: item.quantity,
        })),
      })

      clearCart()
      const url = `/thank-you?order=${result.orderNumber}${result.thankYouToken ? `&token=${result.thankYouToken}` : ""}`
      router.push(url)
    } catch {
      setError("Ошибка при оформлении заказа. Попробуйте ещё раз.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form */}
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold">Контактные данные</h2>

          {isCustomer && profile && (
            <p className="text-sm text-muted-foreground bg-primary/5 rounded-xl px-4 py-2">
              Данные заполнены из вашего профиля
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Имя *</label>
              <input
                name="name"
                required
                defaultValue={profile?.name || ""}
                className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Телефон *</label>
              <input
                name="phone"
                type="tel"
                required
                defaultValue={profile?.phone || ""}
                className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              name="email"
              type="email"
              defaultValue={profile?.email || ""}
              className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="email@example.com"
            />
          </div>

          <h2 className="text-lg font-semibold pt-2">Доставка</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Способ доставки</label>
            <select name="delivery" className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="cdek">СДЭК</option>
              <option value="post">Почта России</option>
              <option value="courier">Курьер (Калининград)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Адрес доставки</label>
            <textarea
              name="address"
              rows={2}
              defaultValue={profile?.defaultAddress || ""}
              className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Город, улица, дом, квартира"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Пожелания к заказу"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

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

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full h-14 bg-primary text-primary-foreground rounded-xl text-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Оформление..." : `Оформить заказ — ${finalTotal}₽`}
          </button>
        </form>
      </div>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
          <h2 className="text-lg font-semibold mb-4">Ваш заказ</h2>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-3">
                {item.image && (
                  <Image src={item.image} alt={item.name} width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.weight} x {item.quantity}</p>
                </div>
                <p className="text-sm font-medium">{item.price * item.quantity}₽</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Подытог</span>
              <span>{total}₽</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Скидка ({promoCode})</span>
                <span>-{promoDiscount}₽</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Доставка</span>
              <span>{deliveryPrice === 0 ? "Бесплатно" : `${deliveryPrice}₽`}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Итого</span>
              <span className="text-primary">{finalTotal}₽</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
