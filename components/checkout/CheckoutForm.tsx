"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import Link from "next/link"
import { useCartStore } from "@/lib/store/cart"
import { useDeliveryStore } from "@/lib/store/delivery"
import { createOrder } from "@/lib/actions/orders"
import { CitySearch } from "./CitySearch"
import { AddressInput } from "./AddressInput"
import { DeliveryOptions } from "./DeliveryOptions"
import { PickupPointMap } from "./PickupPointMap"
import { PhoneInput } from "@/components/ui/phone-input"

interface UserProfile {
  name: string | null
  email: string | null
  phone: string | null
  defaultAddress: string | null
}

interface SavedAddress {
  id: string
  title: string
  fullAddress: string
  recipientName: string | null
  recipientPhone: string | null
  isDefault: boolean
}

export function CheckoutForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const clearCart = useCartStore((s) => s.clearCart)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)
  const setDoorAddress = useDeliveryStore((s) => s.setDoorAddress)
  const deliveryCity = useDeliveryStore((s) => s.city)
  const deliveryCityCode = useDeliveryStore((s) => s.cityCode)
  const deliveryPostalCode = useDeliveryStore((s) => s.postalCode)
  const resetDelivery = useDeliveryStore((s) => s.reset)

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [agreed, setAgreed] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  // Список товаров, которые backend отверг из-за stock/price-change.
  // Используется для модалки "Убрать из корзины и продолжить" (P1-2).
  const [unavailableItems, setUnavailableItems] = useState<
    { variantId: string; name: string; available: number; requested: number; reason: string }[]
  >([])
  const removeItem = useCartStore((s) => s.removeItem)
  const paymentMethod = "online" as const

  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  useEffect(() => setMounted(true), [])

  // Fetch profile data for auto-fill
  useEffect(() => {
    if (!isCustomer || !session?.user?.id) return

    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setProfile(data))
      .catch(() => {})

    fetch("/api/addresses")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.addresses && setSavedAddresses(data.addresses))
      .catch(() => {})
  }, [isCustomer, session?.user?.id])

  if (!mounted) return null

  const total = totalPrice()
  const afterDiscount = total - promoDiscount
  const deliveryPrice = selectedRate ? selectedRate.priceWithMarkup : 0
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
    const name = (form.get("name") as string)?.trim()
    const lastName = (form.get("lastName") as string)?.trim()
    const phone = (form.get("phone") as string)?.trim()

    const errors: Record<string, string> = {}
    if (!lastName) errors.lastName = "Укажите фамилию"
    if (!name) errors.name = "Укажите имя"
    if (!phone) {
      errors.phone = "Укажите телефон"
    } else {
      // Accept Russian phone: +7/8 followed by 10 digits
      const digits = phone.replace(/\D/g, "")
      if (!/^[78]\d{10}$/.test(digits)) {
        errors.phone = "Введите корректный номер, например +7 (999) 123-45-67"
      }
    }
    if (!selectedRate) errors.delivery = "Выберите способ доставки"
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setLoading(false)
      return
    }
    setFieldErrors({})

    try {
      if (selectedRate?.deliveryType === "door" && !doorAddress?.trim()) {
        setError("Укажите адрес доставки")
        setLoading(false)
        return
      }
      if (selectedRate?.deliveryType === "pvz" && !selectedPickupPoint) {
        setError("Выберите пункт выдачи")
        setLoading(false)
        return
      }

      // Build delivery address from selected option
      const rawAddress = doorAddress || (form.get("address") as string) || ""
      const fullDoorAddress = deliveryCity && rawAddress
        ? `${deliveryCity}, ${rawAddress}`
        : rawAddress || undefined
      const address =
        selectedRate?.deliveryType === "pvz" && selectedPickupPoint
          ? `ПВЗ: ${selectedPickupPoint.name}, ${selectedPickupPoint.address}`
          : fullDoorAddress

      const result = await createOrder({
        customerName: `${lastName} ${name}`,
        customerEmail: (form.get("email") as string) || undefined,
        customerPhone: form.get("phone") as string,
        deliveryAddress: address,
        deliveryMethod: selectedRate?.carrier || undefined,
        paymentMethod,
        notes: (form.get("notes") as string) || undefined,
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
        // Stock/price изменились — показываем модалку со списком проблемных
        // товаров; юзер одним кликом убирает их и повторяет оформление.
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

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
      } else {
        const url = `/thank-you?order=${result.orderNumber}${result.thankYouToken ? `&token=${result.thankYouToken}` : ""}`
        router.push(url)
      }
    } catch (e) {
      console.error("Checkout submit failed:", e)
      const msg = e instanceof Error ? e.message : "Попробуйте ещё раз"
      setError(`Ошибка при оформлении заказа: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
      {/* Form */}
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-4 sm:space-y-5">
          <h2 className="text-lg font-semibold">Контактные данные</h2>

          {isCustomer && profile && (
            <p className="text-sm text-muted-foreground bg-primary/5 rounded-xl px-4 py-2">
              Данные заполнены из вашего профиля
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Фамилия *</label>
              <input
                name="lastName"
                required
                defaultValue={profile?.name?.split(" ").slice(1).join(" ") || ""}
                onChange={() => setFieldErrors((e) => ({ ...e, lastName: "" }))}
                className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.lastName ? "border-red-400" : "border-input"}`}
                placeholder="Иванов"
              />
              {fieldErrors.lastName && <p className="text-xs text-red-600 mt-1">{fieldErrors.lastName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Имя *</label>
              <input
                name="name"
                required
                defaultValue={profile?.name?.split(" ")[0] || ""}
                onChange={() => setFieldErrors((e) => ({ ...e, name: "" }))}
                className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.name ? "border-red-400" : "border-input"}`}
                placeholder="Иван"
              />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Телефон *</label>
              <PhoneInput
                name="phone"
                required
                defaultValue={profile?.phone || ""}
                onChange={() => setFieldErrors((e) => ({ ...e, phone: "" }))}
                className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${fieldErrors.phone ? "border-red-400" : "border-input"}`}
              />
              {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
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
          </div>

          <h2 className="text-lg font-semibold pt-2">Доставка</h2>

          <CitySearch />
          <DeliveryOptions />

          {/* P1-8: сохранённые адреса залогиненного юзера — выбор из dropdown
              автозаполняет поле адреса и переключает город, если он отличается. */}
          {selectedRate?.deliveryType !== "pvz" && savedAddresses.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">Сохранённые адреса</label>
              <select
                className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                defaultValue=""
                onChange={(e) => {
                  const sel = savedAddresses.find((a) => a.id === e.target.value)
                  if (sel) setDoorAddress(sel.fullAddress)
                }}
              >
                <option value="">— Выберите адрес —</option>
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}: {a.fullAddress}
                    {a.isDefault ? " (по умолчанию)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedRate?.deliveryType !== "pvz" && <AddressInput />}
          {selectedRate?.deliveryType === "pvz" && <PickupPointMap />}


          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Пожелания к заказу"
            />
          </div>

          <h2 className="text-lg font-semibold pt-2">Оплата</h2>

          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
            <div>
              <p className="font-medium text-sm">Онлайн-оплата</p>
              <p className="text-xs text-muted-foreground">Банковская карта, СБП, ЮMoney</p>
            </div>
          </div>

          {deliveryCity && !selectedRate && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
              Выберите способ доставки, чтобы продолжить оформление
            </p>
          )}

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
            disabled={loading || !agreed || !selectedRate}
            className="w-full min-h-12 sm:min-h-14 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm sm:text-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-normal leading-tight"
          >
            {loading
              ? "Оформление..."
              : paymentMethod === "online"
                ? `Оплатить — ${finalTotal}₽`
                : `Оформить заказ — ${finalTotal}₽`}
          </button>
        </form>
      </div>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm lg:sticky lg:top-24">
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

      {/* Модалка P1-2: stock/цена поменялись между корзиной и submit'ом.
          Юзер в один клик убирает проблемные товары и продолжает оформление. */}
      {unavailableItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Товары изменили статус</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Пока вы оформляли заказ, эти товары стали недоступны или изменились в цене. Мы не можем оформить заказ, пока они в корзине.
            </p>
            <ul className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {unavailableItems.map((u) => (
                <li key={u.variantId} className="text-sm bg-amber-50 rounded-xl px-3 py-2">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-amber-700">
                    {u.reason === "out_of_stock" && "Нет в наличии"}
                    {u.reason === "insufficient_stock" && `Доступно только ${u.available} из запрошенных ${u.requested}`}
                    {u.reason === "inactive" && "Товар снят с продажи"}
                    {u.reason === "price_changed" && "Цена изменилась"}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  for (const u of unavailableItems) removeItem(u.variantId)
                  setUnavailableItems([])
                }}
                className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Убрать из корзины и продолжить
              </button>
              <button
                type="button"
                onClick={() => setUnavailableItems([])}
                className="flex-1 h-11 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
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
