"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, Eye, EyeOff, Lock, UserPlus } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { usePendingPaymentStore } from "@/lib/store/pending-payment"
import { createOrder } from "@/lib/actions/orders"
import { registerUser } from "@/lib/actions/auth"
import { GiftPicker } from "../GiftPicker"
import { ReplacementPicker } from "../ReplacementPicker"
import { useWelcomeDiscount } from "@/lib/hooks/use-welcome-discount"
import type { RecommendedProduct } from "@/lib/types"

interface UnavailableItem {
  variantId: string
  name: string
  available: number
  requested: number
  reason: string
  currentPrice?: number
}

interface DeliveryPriceMismatch {
  clientPrice: number
  serverPrice: number
}

export function PaymentStep({ finalTotal }: { finalTotal: number }) {
  const router = useRouter()
  const { data: session } = useSession()
  // Скрываем блок «создать аккаунт» только для уже авторизованных покупателей.
  // Для админа, гостя без сессии и неавторизованных — показываем.
  const isCustomer = (session?.user as Record<string, unknown> | undefined)?.userType === "customer"

  const items = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const clearCart = useCartStore((s) => s.clearCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const updatePrice = useCartStore((s) => s.updatePrice)
  const addItem = useCartStore((s) => s.addItem)

  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectRate = useDeliveryStore((s) => s.selectRate)
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
  const createAccount = useCheckoutWizard((s) => s.createAccount)
  const setCreateAccount = useCheckoutWizard((s) => s.setCreateAccount)
  const accountPassword = useCheckoutWizard((s) => s.accountPassword)
  const setAccountPassword = useCheckoutWizard((s) => s.setAccountPassword)
  const setStep = useCheckoutWizard((s) => s.setStep)
  const resetWizard = useCheckoutWizard((s) => s.reset)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null)
  const [unavailableItems, setUnavailableItems] = useState<UnavailableItem[]>([])
  const [priceMismatch, setPriceMismatch] = useState<DeliveryPriceMismatch | null>(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [accountError, setAccountError] = useState("")
  // C1: idempotency key. Генерится один раз при монтировании PaymentStep
  // и переживает все ре-рендеры. При двойном submit сервер вернёт уже
  // созданный заказ вместо дубля. На каждое новое посещение checkout —
  // новый id (компонент перемонтируется через CheckoutForm).
  const clientRequestIdRef = useRef<string>("")
  if (!clientRequestIdRef.current) {
    clientRequestIdRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `crid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
  // Порог бесплатной доставки тянем для подсветки в ReplacementPicker
  // («+ откроется бесплатная доставка»). Один лёгкий fetch на маунт.
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(0)
  useEffect(() => {
    fetch("/api/delivery/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.freeDeliveryThreshold) setFreeDeliveryThreshold(d.freeDeliveryThreshold)
      })
      .catch(() => {})
  }, [])
  const showRegistrationPrompt = !isCustomer

  // Pass-2-A: совпадает с CheckoutForm + сервером (promo XOR welcome).
  // Используется для giftThreshold-проверки и cartTotal в GiftPicker.
  const subtotalForDiscount = totalPrice()
  const welcomeForCart = useWelcomeDiscount(subtotalForDiscount).value
  const effectiveDiscountForCart =
    promoDiscount > 0 ? promoDiscount : welcomeForCart?.discount ?? 0
  const afterDiscount = subtotalForDiscount - effectiveDiscountForCart
  const deliveryPrice = selectedRate ? selectedRate.priceWithMarkup : 0

  function validateAccountPassword(value: string): string {
    // Зеркалирует серверные правила из registerUser (lib/actions/auth.ts):
    // ≥8 символов, хотя бы одна буква (RU/EN) и одна цифра. Без спецсимволов,
    // чтобы не путать менеджеры паролей.
    if (value.length < 8) return "Пароль должен быть не менее 8 символов"
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(value) || !/\d/.test(value)) {
      return "Пароль должен содержать хотя бы одну букву и одну цифру"
    }
    return ""
  }

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
    // Если юзер хочет создать аккаунт — нужны email + валидный пароль.
    // Email вводится на шаге Контакты, поэтому при отсутствии возвращаем туда.
    if (showRegistrationPrompt && createAccount) {
      if (!contact.email.trim()) {
        setAccountError("Чтобы создать аккаунт, укажите email на шаге «Контакты»")
        setStep("contact")
        return
      }
      const passwordError = validateAccountPassword(accountPassword)
      if (passwordError) {
        setAccountError(passwordError)
        return
      }
    }
    if (loading) return

    setLoading(true)
    setError("")
    setAccountError("")
    try {
      // I6: pre-submit recheck подарка. Между моментом загрузки списка
      // в GiftPicker и submit'ом мог пройти час — gift могли разобрать.
      // Сервер всё равно поймает, но кинет ошибку и пошлёт юзера на
      // refresh; здесь же мы тихо снимаем выбор и продолжаем.
      let giftIdForOrder = selectedGiftId
      if (selectedGiftId) {
        try {
          const r = await fetch(
            `/api/gifts/available?cartTotal=${encodeURIComponent(afterDiscount)}`
          )
          if (r.ok) {
            const data = await r.json()
            const stillAvailable = (data?.gifts ?? []).some(
              (g: { id: string }) => g.id === selectedGiftId
            )
            if (!stillAvailable) {
              giftIdForOrder = null
              setSelectedGiftId(null)
              setError(
                "Выбранный подарок только что разобрали — оформляем заказ без него"
              )
            }
          }
        } catch {
          // Network ошибка — не блокируем оформление, серверная валидация
          // в любом случае поймает.
        }
      }

      const rawAddress = doorAddress || ""
      const fullDoorAddress =
        deliveryCity && rawAddress ? `${deliveryCity}, ${rawAddress}` : rawAddress || undefined
      const address =
        selectedRate?.deliveryType === "pvz" && selectedPickupPoint
          ? `ПВЗ: ${selectedPickupPoint.name}, ${selectedPickupPoint.address}`
          : fullDoorAddress

      const result = await createOrder({
        clientRequestId: clientRequestIdRef.current,
        // Pass-2-B: финал, который видит юзер на кнопке. Сервер сравнит,
        // не списать ли больше — если да, остановит и попросит refresh.
        expectedFinalTotal: finalTotal,
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
        selectedGiftId: giftIdForOrder,
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
        if (result.totalMismatch) {
          // Pass-2-B: серверный пересчёт дал большую сумму — кнопка
          // показывала меньшую. Просим пользователя обновить страницу,
          // чтобы он увидел корректный итог перед оплатой.
          setError(
            `Сумма заказа изменилась: было ${result.totalMismatch.clientTotal}₽, стало ${result.totalMismatch.serverTotal}₽. Обновите страницу.`
          )
          setLoading(false)
          return
        }
        if (result.deliveryPriceMismatch && selectedRate) {
          // Сервер вернул реальную цену доставки — обновляем выбранный
          // тариф локально, чтобы OrderSummary и кнопка «Оплатить» сразу
          // показали итог = серверный итог. Юзер увидит модалку и
          // подтвердит ещё раз; следующий submit пройдёт без рассинхрона.
          selectRate({
            ...selectedRate,
            priceWithMarkup: result.deliveryPriceMismatch.serverPrice,
          })
          setPriceMismatch(result.deliveryPriceMismatch)
          setLoading(false)
          return
        }
        setError(result.error)
        setLoading(false)
        return
      }

      // G3: снимаем abandoned-tracking — заказ реально создан, не нужно
      // слать recovery. Fire-and-forget, не блокируем redirect.
      if (contact.email?.trim()) {
        fetch(`/api/cart/track-abandoned?email=${encodeURIComponent(contact.email.trim().toLowerCase())}`, {
          method: "DELETE",
        }).catch(() => {})
      }

      // Регистрируем покупателя, если попросил «сохранить данные».
      // Гонимся за тем, чтобы request долетел до сервера до редиректа на YooKassa,
      // но не блокируем дольше 2.5с — серверный action всё равно дозавершит работу
      // и пришлёт письмо. Ошибки (например, email уже подтверждён) не мешают
      // оформлению заказа: linkGuestOrders подцепит этот заказ, когда юзер
      // подтвердит email через /auth/verify.
      let pendingVerificationEmail: string | null = null
      if (
        showRegistrationPrompt &&
        createAccount &&
        contact.email.trim() &&
        accountPassword
      ) {
        const email = contact.email.trim()
        const fullName = `${contact.lastName.trim()} ${contact.firstName.trim()}`.trim()
        const regPromise = registerUser({
          email,
          password: accountPassword,
          name: fullName,
        }).catch((err) => {
          console.error("Account registration after order failed:", err)
          return null
        })
        const regResult = await Promise.race([
          regPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ])
        // M1: показываем banner «подтвердите email» только если регистрация
        // успешно стартовала (новый или unverified user). Если email уже был
        // верифицирован, registerUser вернёт {error: "уже зарегистрирован"} —
        // тогда banner будет вводить в заблуждение.
        if (regResult && "success" in regResult && regResult.success) {
          pendingVerificationEmail = email
        } else if (regResult === null) {
          // Race lost — серверный action всё ещё работает в background. Не
          // знаем результат, но безопаснее показать banner: если eventually
          // верификация не нужна, юзер просто проигнорирует.
          pendingVerificationEmail = email
        }
        // Если regResult.error — banner НЕ ставим.
      }

      // I5 (B-1): сохраняем snapshot ДО очистки клиентского состояния.
      // Если юзер закроет вкладку на платёжке или нажмёт «Назад» —
      // PendingPaymentBanner на /cart покажет «Завершите оплату».
      // 10 минут — стандартный TTL confirmation_url у YooKassa; после
      // — endpoint /repay перевыпустит платёж для того же заказа.
      if (result.paymentUrl && result.trackingToken) {
        usePendingPaymentStore.getState().setPending({
          orderId: result.id,
          orderNumber: result.orderNumber,
          amount: result.total,
          paymentUrl: result.paymentUrl,
          trackingToken: result.trackingToken,
          createdAt: Date.now(),
          expiresAt: Date.now() + 10 * 60 * 1000,
        })
      }

      clearCart()
      resetDelivery()
      resetWizard()

      // Сохраняем email для thank-you, чтобы показать банер «подтвердите email».
      // Sessionstorage переживает редирект на YooKassa и обратно (тот же таб + тот
      // же origin при возврате).
      if (pendingVerificationEmail && typeof window !== "undefined") {
        try {
          sessionStorage.setItem("checkoutPendingVerification", pendingVerificationEmail)
        } catch {
          // Privacy mode / quota — банер просто не покажется, не критично.
        }
      }

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
      // Если бандл устарел после деплоя, action-id из открытой вкладки
      // не резолвится на новом сервере. Перезагружаем страницу, чтобы
      // покупатель получил свежий бандл — корзина в localStorage,
      // данные шага в Zustand persist, ничего не теряется.
      if (/Server Action.*was not found/i.test(msg)) {
        setError("Обновляем форму — секунду…")
        window.location.reload()
        return
      }
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
          enterKeyHint="done"
          className="w-full px-4 py-3 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Пожелания курьеру, время доставки и т.п."
        />
      </div>

      <GiftPicker
        cartTotal={afterDiscount}
        value={selectedGiftId}
        onChange={setSelectedGiftId}
      />

      {showRegistrationPrompt && (
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={createAccount}
              onChange={(e) => {
                setCreateAccount(e.target.checked)
                if (!e.target.checked) {
                  setAccountPassword("")
                  setAccountError("")
                }
              }}
              className="mt-0.5 h-5 w-5 rounded border-input accent-primary shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <UserPlus className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  Сохранить данные для следующих заказов
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {contact.email.trim() ? (
                  <>
                    Создадим личный кабинет на{" "}
                    <span className="font-medium text-foreground">
                      {contact.email.trim()}
                    </span>{" "}
                    — в следующий раз не нужно будет заполнять адрес и контакты заново.
                  </>
                ) : (
                  <>
                    Укажите email на шаге{" "}
                    <button
                      type="button"
                      onClick={() => setStep("contact")}
                      className="text-primary hover:underline"
                    >
                      «Контакты»
                    </button>
                    , чтобы создать личный кабинет и не вводить адрес повторно.
                  </>
                )}
              </p>
            </div>
          </label>

          {createAccount && (
            <div className="mt-3 pl-7">
              <label className="block text-xs font-medium mb-1">Пароль для входа</label>
              <div className="relative">
                <input
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  minLength={8}
                  value={accountPassword}
                  onChange={(e) => {
                    setAccountPassword(e.target.value)
                    if (accountError) setAccountError("")
                  }}
                  className={`w-full h-11 px-4 pr-10 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    accountError ? "border-red-400" : "border-input"
                  }`}
                  placeholder="Минимум 8 символов, буква и цифра"
                />
                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                >
                  {passwordVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {accountError && (
                <p className="text-xs text-red-600 mt-1">{accountError}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1.5">
                После оплаты пришлём письмо для подтверждения email — переходить
                сразу не обязательно.
              </p>
            </div>
          )}
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer min-h-[44px] py-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-input accent-primary shrink-0"
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
        <UnavailableItemsModal
          items={unavailableItems}
          freeDeliveryThreshold={freeDeliveryThreshold}
          onReplace={(oldItem, replacement) => {
            // Атомарно: убираем старую позицию и кладём новую с тем же
            // количеством. Цены в локальном кэше — снимок на момент
            // выбора замены; серверный re-validate в createOrder поймает,
            // если за эти секунды что-то снова изменится.
            const cartItem = items.find((i) => i.variantId === oldItem.variantId)
            const quantity = cartItem?.quantity ?? oldItem.requested
            removeItem(oldItem.variantId)
            // I4: уважаем stock замены — если меньше, чем было в корзине,
            // ставим максимум доступного, чтобы не словить OOS снова на
            // следующем submit. Информируем пользователя через toast-ish error.
            const realQty = Math.min(quantity, replacement.recommendedVariant.stock)
            if (realQty <= 0) {
              setError(
                `«${replacement.name}» только что разобрали. Выберите другую замену`
              )
              return
            }
            if (realQty < quantity) {
              setError(
                `Доступно только ${realQty} шт. «${replacement.name}» — добавили это количество`
              )
            }
            addItem({
              productId: replacement.id,
              variantId: replacement.recommendedVariant.id,
              name: replacement.name,
              weight: replacement.recommendedVariant.weight,
              price: replacement.recommendedVariant.price,
              image: replacement.primaryImage,
              quantity: realQty,
              slug: replacement.slug,
              // Pass-2-D: используем realQty не как stockSnapshot — последний
              // должен быть РЕАЛЬНЫМ stock, чтобы CartDrawer корректно
              // дизейблил «+». Берём оригинал.
              stockSnapshot: replacement.recommendedVariant.stock,
            })
            setUnavailableItems((prev) =>
              prev.filter((u) => u.variantId !== oldItem.variantId)
            )
          }}
          onSkip={(oldItem) => {
            removeItem(oldItem.variantId)
            setUnavailableItems((prev) =>
              prev.filter((u) => u.variantId !== oldItem.variantId)
            )
          }}
          onUpdatePrices={() => {
            for (const u of unavailableItems) {
              if (u.currentPrice !== undefined) updatePrice(u.variantId, u.currentPrice)
            }
            setUnavailableItems([])
          }}
          onClose={() => setUnavailableItems([])}
        />
      )}

      {priceMismatch && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Доставка пересчитана</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Сумма заказа изменилась — после удаления товара из корзины она
              стала ниже порога бесплатной доставки. Стоимость доставки сейчас{" "}
              <span className="font-medium text-foreground">
                {priceMismatch.serverPrice}₽
              </span>{" "}
              вместо{" "}
              <span className="line-through">{priceMismatch.clientPrice}₽</span>.
              Подтвердите оплату на новой сумме.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPriceMismatch(null)}
                className="h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Понятно, посмотреть итог
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface UnavailableItemsModalProps {
  items: UnavailableItem[]
  freeDeliveryThreshold: number
  onReplace: (oldItem: UnavailableItem, replacement: RecommendedProduct) => void
  onSkip: (oldItem: UnavailableItem) => void
  onUpdatePrices: () => void
  onClose: () => void
}

function UnavailableItemsModal({
  items,
  freeDeliveryThreshold,
  onReplace,
  onSkip,
  onUpdatePrices,
  onClose,
}: UnavailableItemsModalProps) {
  const cartItems = useCartStore((s) => s.items)
  const totalPrice = useCartStore((s) => s.totalPrice)()

  // Все товары — это просто "цена изменилась"? Тогда показываем компактную
  // модалку как раньше: одна кнопка "обновить цены и продолжить", без
  // подбора замен (товар-то в наличии, юзер просто увидел свежий ценник).
  const allPriceChanged = items.every(
    (u) => u.reason === "price_changed" && u.currentPrice !== undefined
  )

  // Out-of-stock / inactive / insufficient_stock — кандидаты на замену.
  const replaceable = items.filter(
    (u) =>
      u.reason === "out_of_stock" ||
      u.reason === "inactive" ||
      u.reason === "insufficient_stock"
  )

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2">Корзина изменилась</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Пока вы оформляли заказ, что-то изменилось у пары позиций. Решим за
          несколько секунд.
        </p>

        {allPriceChanged ? (
          <>
            <ul className="space-y-2 mb-5 max-h-48 overflow-y-auto">
              {items.map((u) => (
                <li key={u.variantId} className="text-sm bg-amber-50 rounded-xl px-3 py-2">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-amber-700">
                    {u.currentPrice !== undefined
                      ? `Цена изменилась, актуальная — ${u.currentPrice}₽`
                      : "Цена изменилась"}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onUpdatePrices}
                className="h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Обновить цены и продолжить
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-11 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
              >
                Отменить
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              {replaceable.map((u) => {
                const cartItem = cartItems.find((i) => i.variantId === u.variantId)
                const lineTotal = cartItem ? cartItem.price * cartItem.quantity : 0
                const cartTotalWithoutItem = Math.max(0, totalPrice - lineTotal)
                return (
                  <ReplacementPicker
                    key={u.variantId}
                    variantId={u.variantId}
                    productName={u.name}
                    quantity={cartItem?.quantity ?? u.requested ?? 1}
                    cartTotalWithoutItem={cartTotalWithoutItem}
                    freeDeliveryThreshold={freeDeliveryThreshold}
                    onReplace={(rec) => onReplace(u, rec)}
                    onSkip={() => onSkip(u)}
                  />
                )
              })}
              {/* Просто-уведомления о price_changed (если есть вместе с OOS) */}
              {items
                .filter((u) => !replaceable.includes(u))
                .map((u) => (
                  <div
                    key={u.variantId}
                    className="text-sm bg-amber-50 rounded-xl px-3 py-2"
                  >
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-amber-700">
                      {u.reason === "price_changed" && u.currentPrice !== undefined
                        ? `Цена изменилась, актуальная — ${u.currentPrice}₽`
                        : "Изменилось"}
                    </p>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
            >
              Закрыть
            </button>
          </>
        )}
      </div>
    </div>
  )
}
