export const dynamic = "force-dynamic"

import { getDeliverySettings, getMarkupRules, getDeliveryRules } from "@/lib/dal/delivery-settings"
import { prisma } from "@/lib/prisma"
import { DeliverySettingsForm } from "@/components/admin/DeliverySettingsForm"
import { DeliveryRulesManager } from "@/components/admin/DeliveryRulesManager"

export default async function AdminDeliveryPage() {
  const [settings, rules, deliveryRules] = await Promise.all([
    getDeliverySettings(),
    getMarkupRules(),
    prisma.deliveryRule.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Настройки доставки</h1>
      <DeliverySettingsForm settings={settings} rules={rules} />
      <div className="mt-8">
        <DeliveryRulesManager initialRules={deliveryRules} />
      </div>
    </div>
  )
}
