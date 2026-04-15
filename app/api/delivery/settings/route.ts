import { NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export async function GET() {
  try {
    const settings = await getDeliverySettings()

    // Public-safe settings only. Yandex Maps key is intentionally public
    // (required by JS SDK in browser) — restrict it by HTTP Referer in Yandex console.
    return NextResponse.json({
      freeDeliveryThreshold: parseInt(settings.free_delivery_threshold) || 0,
      giftThreshold: parseInt(settings.gift_threshold) || 0,
      giftDescription: settings.gift_description || "Подарок от нас",
      yandexMapsApiKey: settings.yandex_maps_api_key || "",
      cdekEnabled: settings.cdek_enabled === "true",
      pochtaEnabled: settings.pochta_enabled === "true",
      courierEnabled: settings.courier_enabled === "true",
      courierCity: settings.courier_city || "",
    })
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}
