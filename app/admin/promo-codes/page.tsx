export const dynamic = "force-dynamic"

import { getPromoCodes } from "@/lib/dal/promo-codes"
import { PromoCodeManager } from "@/components/admin/PromoCodeManager"

export default async function AdminPromoCodesPage() {
  const { promoCodes } = await getPromoCodes()

  const serialized = promoCodes.map((p) => ({
    id: p.id,
    name: p.name,
    comment: p.comment,
    code: p.code,
    type: p.type as "percent" | "fixed",
    value: p.value,
    startDate: p.startDate.toISOString(),
    endDate: p.endDate.toISOString(),
    usageCount: p.usageCount,
    maxUsage: p.maxUsage,
    minOrderSum: p.minOrderSum,
    isActive: p.isActive,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Промокоды</h1>
      <PromoCodeManager promoCodes={serialized} />
    </div>
  )
}
