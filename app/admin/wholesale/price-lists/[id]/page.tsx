import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { getPriceListById, getAllActiveVariantsForPricing } from "@/lib/dal/wholesale-price-lists"
import { PriceListEditor } from "@/components/admin/wholesale/PriceListEditor"

export const dynamic = "force-dynamic"

export default async function AdminWholesalePriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin("wholesale.priceLists.view")
  const { id } = await params
  const [priceList, allVariants] = await Promise.all([
    getPriceListById(id),
    getAllActiveVariantsForPricing(),
  ])
  if (!priceList) notFound()

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <Link href="/admin/wholesale/price-lists" className="text-sm text-muted-foreground hover:text-foreground">
          ← Все прайс-листы
        </Link>
        <h1 className="text-2xl font-bold mt-1">{priceList.name}</h1>
        <p className="text-sm text-muted-foreground">
          {priceList.kind === "fixed"
            ? "Фиксированные цены"
            : `Скидка ${priceList.discountPct}% от розничной`}
          {priceList.minOrderSum && ` · мин. заказ ${priceList.minOrderSum}₽`}
          {priceList.isActive ? " · активен" : " · выключен"}
        </p>
      </div>

      <PriceListEditor priceList={priceList} allVariants={allVariants} />
    </div>
  )
}
