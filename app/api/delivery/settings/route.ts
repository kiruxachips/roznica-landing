import { NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import { areGiftsEnabled, getMinGiftThreshold } from "@/lib/dal/gifts"

export async function GET() {
  try {
    const [settings, giftsEnabled, minGiftThreshold] = await Promise.all([
      getDeliverySettings(),
      areGiftsEnabled(),
      getMinGiftThreshold(),
    ])

    // Если kill-switch выключен — возвращаем giftThreshold=0, чтобы UI
    // (CartGiftProgress и др.) вообще не показывал прогресс до подарка.
    // Иначе приоритет у минимального порога активных Gift (после миграции
    // на пул); legacy settings.gift_threshold — fallback для старых деплоев
    // без Gift-записей.
    const giftThreshold = !giftsEnabled
      ? 0
      : minGiftThreshold > 0
        ? minGiftThreshold
        : parseInt(settings.gift_threshold) || 0

    return NextResponse.json(
      {
        freeDeliveryThreshold: parseInt(settings.free_delivery_threshold) || 0,
        giftThreshold,
        giftDescription: settings.gift_description || "Подарок от нас",
        giftsEnabled,
        yandexMapsApiKey: settings.yandex_maps_api_key || "",
        cdekEnabled: settings.cdek_enabled === "true",
        pochtaEnabled: settings.pochta_enabled === "true",
        courierEnabled: settings.courier_enabled === "true",
        courierCity: settings.courier_city || "",
      },
      {
        headers: {
          // Запрещаем браузерный/прокси-кэш — при toggle kill-switch клиент
          // должен увидеть новое состояние немедленно, без ожидания TTL.
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch {
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}
