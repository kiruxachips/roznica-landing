import { NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import { getMinGiftThreshold } from "@/lib/dal/gifts"

export async function GET() {
  try {
    const [settings, minGiftThreshold] = await Promise.all([
      getDeliverySettings(),
      getMinGiftThreshold(),
    ])

    // G6: giftThreshold приоритетно берём из минимального порога активных
    // Gift-записей — это источник правды после миграции на управляемый пул
    // подарков. Legacy gift_threshold из DeliverySetting оставлен как fallback
    // для старых деплоев без созданных Gift, чтобы UI-прогресс не сломался.
    const giftThreshold =
      minGiftThreshold > 0
        ? minGiftThreshold
        : parseInt(settings.gift_threshold) || 0

    return NextResponse.json({
      freeDeliveryThreshold: parseInt(settings.free_delivery_threshold) || 0,
      giftThreshold,
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
