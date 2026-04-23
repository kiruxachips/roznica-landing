"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { StepIndicator } from "./StepIndicator"
import { OrderSummary } from "./OrderSummary"
import { ContactStep } from "./steps/ContactStep"
import { DeliveryStep } from "./steps/DeliveryStep"
import { PaymentStep } from "./steps/PaymentStep"

export function CheckoutForm() {
  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const deliveryCity = useDeliveryStore((s) => s.city)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)

  const step = useCheckoutWizard((s) => s.step)
  const completed = useCheckoutWizard((s) => s.completed)
  const contact = useCheckoutWizard((s) => s.contact)
  const setStep = useCheckoutWizard((s) => s.setStep)
  const resetWizard = useCheckoutWizard((s) => s.reset)
  const agreed = useCheckoutWizard((s) => s.agreed)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Если юзер вернулся на /checkout с пустой корзиной — сбрасываем wizard,
  // чтобы не «подвешивать» заполненные шаги поверх несуществующего заказа.
  // Если он добавит товары и вернётся, начнём с чистого первого шага.
  useEffect(() => {
    if (mounted && items.length === 0) resetWizard()
  }, [mounted, items.length, resetWizard])

  if (!mounted) return null

  if (items.length === 0) {
    return (
      <div className="text-center py-16 sm:py-20">
        <h1 className="font-sans text-2xl sm:text-3xl font-bold mb-3">Корзина пуста</h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Нечего оформлять. Добавьте товары в корзину — и вернитесь сюда для оформления.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/catalog"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            Перейти в каталог
          </Link>
          <Link
            href="/"
            className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    )
  }

  const total = totalPrice()
  const afterDiscount = total - promoDiscount
  const deliveryPrice = selectedRate ? selectedRate.priceWithMarkup : 0
  const finalTotal = afterDiscount + deliveryPrice

  const contactSummary =
    completed.contact &&
    `${contact.lastName} ${contact.firstName}`.trim() +
      (contact.phone ? ` · ${contact.phone}` : "")

  const deliverySummary =
    completed.delivery && selectedRate
      ? selectedRate.deliveryType === "pvz" && selectedPickupPoint
        ? `${selectedRate.carrierName} · ПВЗ: ${selectedPickupPoint.address}`
        : selectedRate.deliveryType === "door"
        ? `${selectedRate.carrierName} · ${deliveryCity}, ${doorAddress || ""}`
        : selectedRate.carrierName
      : ""

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
      <div className="lg:col-span-2 space-y-3 sm:space-y-4">
        <StepIndicator />

        {/* Шаг 1: контакты. Показан, пока активен; иначе compact-summary. */}
        {step === "contact" ? (
          <ContactStep />
        ) : (
          <StepSummary
            title="Контакты"
            summary={contactSummary || "—"}
            onEdit={() => setStep("contact")}
          />
        )}

        {/* Шаг 2: доставка */}
        {step === "delivery" ? (
          <DeliveryStep />
        ) : completed.delivery ? (
          <StepSummary
            title="Доставка"
            summary={deliverySummary || "—"}
            onEdit={() => setStep("delivery")}
          />
        ) : null}

        {/* Шаг 3: оплата */}
        {step === "payment" && <PaymentStep finalTotal={finalTotal} />}
      </div>

      {/* Order summary */}
      <div className="lg:col-span-1">
        <OrderSummary
          items={items}
          total={total}
          promoCode={promoCode}
          promoDiscount={promoDiscount}
          deliveryPrice={deliveryPrice}
          finalTotal={finalTotal}
        />
      </div>

      {/* Sticky mobile CTA — работает только на шаге "payment", когда кнопка
          уже реально нужна. На первых шагах своя внутренняя кнопка "Далее". */}
      {step === "payment" && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Итого</p>
              <p className="text-lg font-bold text-primary truncate">{finalTotal}₽</p>
            </div>
            <button
              type="button"
              disabled={!agreed}
              onClick={() =>
                document.getElementById("checkout-submit")?.dispatchEvent(
                  new MouseEvent("click", { bubbles: true })
                )
              }
              className="shrink-0 h-12 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Оплатить
            </button>
          </div>
          {!agreed && (
            <p className="px-4 pb-2 text-[11px] text-amber-700">
              Подтвердите согласие с политикой, чтобы продолжить
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StepSummary({
  title,
  summary,
  onEdit,
}: {
  title: string
  summary: string
  onEdit: () => void
}) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{title}</p>
        <p className="text-sm font-medium truncate">{summary}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-sm text-primary hover:underline flex items-center gap-1"
      >
        <Pencil className="w-3.5 h-3.5" />
        Изменить
      </button>
    </div>
  )
}
