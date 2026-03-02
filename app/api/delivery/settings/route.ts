import { NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export async function GET() {
  try {
    const settings = await getDeliverySettings()

    // Only expose public-safe settings
    return NextResponse.json({
      freeDeliveryThreshold: parseInt(settings.free_delivery_threshold) || 0,
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
