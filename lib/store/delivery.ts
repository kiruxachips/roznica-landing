import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { DeliveryRate, PickupPoint } from "@/lib/delivery/types"

interface DeliveryState {
  // City
  city: string
  cityCode: string
  region: string
  postalCode: string
  setCity: (city: string, cityCode: string, region?: string) => void
  setPostalCode: (postalCode: string) => void

  // Rates
  rates: DeliveryRate[]
  ratesLoading: boolean
  ratesError: string
  setRates: (rates: DeliveryRate[]) => void
  setRatesLoading: (loading: boolean) => void
  setRatesError: (error: string) => void

  // Selection
  selectedRate: DeliveryRate | null
  selectRate: (rate: DeliveryRate) => void

  // Pickup points
  pickupPoints: PickupPoint[]
  pickupPointsLoading: boolean
  selectedPickupPoint: PickupPoint | null
  setPickupPoints: (points: PickupPoint[]) => void
  setPickupPointsLoading: (loading: boolean) => void
  selectPickupPoint: (point: PickupPoint) => void

  // Door address
  doorAddress: string
  setDoorAddress: (address: string) => void

  // Reset
  reset: () => void
}

export const useDeliveryStore = create<DeliveryState>()(persist((set) => ({
  city: "",
  cityCode: "",
  region: "",
  postalCode: "",
  setCity: (city, cityCode, region) => set({ city, cityCode, region: region || "" }),
  setPostalCode: (postalCode) => set({ postalCode }),

  rates: [],
  ratesLoading: false,
  ratesError: "",
  setRates: (rates) => set({ rates, ratesError: "" }),
  setRatesLoading: (ratesLoading) => set({ ratesLoading }),
  setRatesError: (ratesError) => set({ ratesError, rates: [] }),

  selectedRate: null,
  selectRate: (selectedRate) =>
    // M3: при смене типа доставки чистим оба поля. door↔pvz toggle раньше
    // оставлял "хвосты": doorAddress висел после переключения на ПВЗ,
    // selectedPickupPoint оставался null (ОК) но ниже по дереву компоненты
    // могли подцепить устаревший адрес. Цена доставки уже корректно
    // обновляется через useDeliveryRates.
    set((state) => ({
      selectedRate,
      selectedPickupPoint:
        state.selectedRate?.deliveryType !== selectedRate.deliveryType
          ? null
          : state.selectedPickupPoint,
      doorAddress:
        selectedRate.deliveryType === "pvz" ? "" : state.doorAddress,
    })),

  pickupPoints: [],
  pickupPointsLoading: false,
  selectedPickupPoint: null,
  setPickupPoints: (pickupPoints) => set({ pickupPoints }),
  setPickupPointsLoading: (pickupPointsLoading) => set({ pickupPointsLoading }),
  selectPickupPoint: (selectedPickupPoint) => set({ selectedPickupPoint }),

  doorAddress: "",
  setDoorAddress: (doorAddress) => set({ doorAddress }),

  reset: () =>
    set({
      city: "",
      cityCode: "",
      region: "",
      postalCode: "",
      rates: [],
      ratesLoading: false,
      ratesError: "",
      selectedRate: null,
      pickupPoints: [],
      pickupPointsLoading: false,
      selectedPickupPoint: null,
      doorAddress: "",
    }),
}), { name: "millor-delivery" }))
