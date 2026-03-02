export const dynamic = "force-dynamic"

import { getDeliverySettings, getMarkupRules } from "@/lib/dal/delivery-settings"
import { DeliverySettingsForm } from "@/components/admin/DeliverySettingsForm"

export default async function AdminDeliveryPage() {
  const [settings, rules] = await Promise.all([
    getDeliverySettings(),
    getMarkupRules(),
  ])

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Настройки доставки</h1>
      <DeliverySettingsForm settings={settings} rules={rules} />
    </div>
  )
}
