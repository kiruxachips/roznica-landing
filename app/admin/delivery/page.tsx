export const dynamic = "force-dynamic"

import { getDeliverySettings, getMarkupRules } from "@/lib/dal/delivery-settings"
import { prisma } from "@/lib/prisma"
import { DeliverySettingsForm } from "@/components/admin/DeliverySettingsForm"
import { DeliveryRulesManager } from "@/components/admin/DeliveryRulesManager"
import { DeliveryCalculatorTester } from "@/components/admin/DeliveryCalculatorTester"
import { IntegrationLogViewer } from "@/components/admin/IntegrationLogViewer"
import { DeliveryPageTabs } from "@/components/admin/DeliveryPageTabs"

export default async function AdminDeliveryPage() {
  const [settings, rules, deliveryRules, logs] = await Promise.all([
    getDeliverySettings(),
    getMarkupRules(),
    prisma.deliveryRule.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.integrationLog.findMany({
      where: { source: { in: ["cdek", "pochta", "yookassa", "millorbot"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  const sourcesRaw = await prisma.integrationLog.findMany({
    distinct: ["source"],
    select: { source: true },
  })
  const sources = sourcesRaw.map((r) => r.source).sort()

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Настройки доставки</h1>
      <DeliveryPageTabs
        tabs={[
          {
            id: "settings",
            label: "Настройки",
            content: (
              <>
                <DeliverySettingsForm settings={settings} rules={rules} />
                <div className="mt-8">
                  <DeliveryRulesManager initialRules={deliveryRules} />
                </div>
              </>
            ),
          },
          {
            id: "tester",
            label: "Тестовый расчёт",
            content: (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
                <DeliveryCalculatorTester />
              </div>
            ),
          },
          {
            id: "logs",
            label: "Логи интеграций",
            content: (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
                <IntegrationLogViewer
                  initialLogs={logs.map((l) => ({
                    ...l,
                    createdAt: l.createdAt.toISOString(),
                  }))}
                  sources={sources}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
