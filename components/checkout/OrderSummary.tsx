"use client"

import Image from "next/image"
import { User, Truck, MapPin, Home, Sparkles } from "lucide-react"
import type { CartItem } from "@/lib/types"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { useWelcomeDiscount } from "@/lib/hooks/use-welcome-discount"

interface Props {
  items: CartItem[]
  total: number
  promoCode: string | null
  promoDiscount: number
  deliveryPrice: number
  finalTotal: number
}

export function OrderSummary({
  items,
  total,
  promoCode,
  promoDiscount,
  deliveryPrice,
  finalTotal,
}: Props) {
  const contact = useCheckoutWizard((s) => s.contact)
  const completed = useCheckoutWizard((s) => s.completed)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const city = useDeliveryStore((s) => s.city)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)

  const hasContact =
    completed.contact && (contact.firstName || contact.lastName || contact.phone)
  const hasDelivery = completed.delivery && selectedRate
  const isPvz = selectedRate?.deliveryType === "pvz"

  // G1-1: welcome-скидка — единая точка истины через useWelcomeDiscount.
  // Тот же хук использует useDeliveryRates: один fetch, никакого
  // рассинхрона между OrderSummary и серверным расчётом доставки.
  const welcomeDiscount = useWelcomeDiscount(total).value

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm lg:sticky lg:top-24 space-y-4">
      <h2 className="text-lg font-semibold">Ваш заказ</h2>

      {/* Компактная сводка заполненных шагов — появляется постепенно. */}
      {(hasContact || hasDelivery) && (
        <div className="space-y-2.5 pb-3 border-b border-border text-sm">
          {hasContact && (
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {contact.lastName} {contact.firstName}
                </p>
                {contact.phone && (
                  <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                )}
              </div>
            </div>
          )}
          {hasDelivery && (
            <div className="flex items-start gap-2.5">
              {isPvz ? (
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              ) : selectedRate.deliveryType === "door" ? (
                <Home className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              ) : (
                <Truck className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{selectedRate.carrierName}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {isPvz && selectedPickupPoint
                    ? selectedPickupPoint.address
                    : selectedRate.deliveryType === "door"
                    ? [city, doorAddress].filter(Boolean).join(", ") || "Адрес не указан"
                    : `${selectedRate.minDays}-${selectedRate.maxDays} дн.`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Товары. Collapse-возможно если много, но для B-варианта оставим просто
          ограничение высоты и scroll. */}
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {items.map((item) => (
          <div key={item.variantId} className="flex gap-3">
            {item.image && (
              <Image
                src={item.image}
                alt={item.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-lg object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.weight} x {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium whitespace-nowrap">
              {item.price * item.quantity}₽
            </p>
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
        {welcomeDiscount && promoDiscount === 0 && (
          <div className="flex justify-between text-emerald-600 items-center">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Первый заказ −{welcomeDiscount.percent}%
            </span>
            <span>-{welcomeDiscount.discount}₽</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Доставка</span>
          <span>
            {selectedRate ? (deliveryPrice === 0 ? "Бесплатно" : `${deliveryPrice}₽`) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
          <span>Итого</span>
          <span className="text-primary">
            {finalTotal - (welcomeDiscount && promoDiscount === 0 ? welcomeDiscount.discount : 0)}₽
          </span>
        </div>
      </div>
    </div>
  )
}
