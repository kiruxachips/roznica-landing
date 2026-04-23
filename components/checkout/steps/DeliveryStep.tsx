"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { ArrowRight, ArrowLeft, MapPin, Check } from "lucide-react"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { CitySearch } from "../CitySearch"
import { AddressInput } from "../AddressInput"
import { DeliveryOptions } from "../DeliveryOptions"
import { PickupPointModal } from "../PickupPointModal"

interface SavedAddress {
  id: string
  title: string
  fullAddress: string
  recipientName: string | null
  recipientPhone: string | null
  isDefault: boolean
}

export function DeliveryStep() {
  const { data: session } = useSession()
  const city = useDeliveryStore((s) => s.city)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)
  const setDoorAddress = useDeliveryStore((s) => s.setDoorAddress)
  const markCompleted = useCheckoutWizard((s) => s.markCompleted)
  const setStep = useCheckoutWizard((s) => s.setStep)

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [error, setError] = useState("")
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  useEffect(() => {
    if (!isCustomer || !session?.user?.id) return
    fetch("/api/addresses")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.addresses && setSavedAddresses(data.addresses))
      .catch(() => {})
  }, [isCustomer, session?.user?.id])

  // Модалка ПВЗ открывается только по явному клику юзера на кнопку
  // "Выбрать пункт выдачи на карте" или "Изменить". Автооткрытие при
  // переключении перевозчика ломало flow: юзер хочет сравнить СДЭК/Почту,
  // а ему в лицо прыгает карта.

  function validate(): boolean {
    if (!city) {
      setError("Выберите город доставки")
      return false
    }
    if (!selectedRate) {
      setError("Выберите способ доставки")
      return false
    }
    if (selectedRate.deliveryType === "door" && !doorAddress?.trim()) {
      setError("Укажите адрес доставки")
      return false
    }
    if (selectedRate.deliveryType === "pvz" && !selectedPickupPoint) {
      setError("Выберите пункт выдачи")
      return false
    }
    setError("")
    return true
  }

  function handleNext() {
    if (!validate()) return
    markCompleted("delivery")
    setStep("payment")
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Доставка</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Выберите город и удобный способ получения заказа
        </p>
      </div>

      <CitySearch />
      <DeliveryOptions />

      {selectedRate?.deliveryType === "pvz" && (
        <div>
          <label className="block text-sm font-medium mb-2">Пункт выдачи</label>
          {selectedPickupPoint ? (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <Check className="w-4 h-4 text-primary" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{selectedPickupPoint.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPickupPoint.address}
                  </p>
                  {selectedPickupPoint.workTime && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPickupPoint.workTime}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(true)}
                  className="shrink-0 text-sm text-primary hover:underline font-medium"
                >
                  Изменить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickupModalOpen(true)}
              className="w-full h-14 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/70 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium text-primary"
            >
              <MapPin className="w-4 h-4" />
              Выбрать пункт выдачи на карте
            </button>
          )}
        </div>
      )}

      {selectedRate?.deliveryType === "door" && savedAddresses.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">Сохранённые адреса</label>
          <select
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            defaultValue=""
            onChange={(e) => {
              const sel = savedAddresses.find((a) => a.id === e.target.value)
              if (!sel) return
              setDoorAddress(sel.fullAddress)
              const firstPart = sel.fullAddress.split(",")[0]?.trim() || ""
              if (
                city &&
                firstPart &&
                firstPart.toLowerCase() !== city.toLowerCase()
              ) {
                setError(
                  `Адрес относится к другому городу (${firstPart}). Обновите «Город доставки», иначе стоимость будет рассчитана для «${city}».`
                )
              } else {
                setError("")
              }
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

      {selectedRate?.deliveryType === "door" && <AddressInput />}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          type="button"
          onClick={() => setStep("contact")}
          className="h-12 px-5 border border-border rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 h-12 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          Продолжить к оплате
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <PickupPointModal
        open={pickupModalOpen}
        onClose={() => setPickupModalOpen(false)}
      />
    </div>
  )
}
