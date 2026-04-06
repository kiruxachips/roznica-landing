import { create } from "zustand"
import { persist } from "zustand/middleware"

interface DeliveryRate {
  carrier: string
  carrierName: string
  tariffCode: number
  tariffName: string
  deliveryType: "door" | "pvz"
  price: number
  priceWithMarkup: number
  minDays: number
  maxDays: number
}

interface PickupPoint {
  code: string
  name: string
  address: string
  lat: number
  lng: number
  phone?: string
  workTime?: string
  carrier: string
}

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
  selectRate: (selectedRate) => set({ selectedRate, selectedPickupPoint: null }),

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
