import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { listPriceLists } from "@/lib/dal/wholesale-price-lists"
import { CreatePriceListButton } from "@/components/admin/wholesale/CreatePriceListButton"

export const dynamic = "force-dynamic"

export default async function AdminWholesalePriceListsPage() {
  await requireAdmin("wholesale.priceLists.view")
  const priceLists = await listPriceLists()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Прайс-листы</h1>
        <CreatePriceListButton />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {priceLists.map((p) => (
          <Link
            key={p.id}
            href={`/admin/wholesale/price-lists/${p.id}`}
            className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{p.name}</h3>
              <span
                className={`text-xs rounded-full px-2 py-0.5 ${
                  p.isActive
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : "bg-gray-50 text-gray-600 border border-gray-200"
                }`}
              >
                {p.isActive ? "Активен" : "Выключен"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>
                Тип: {p.kind === "fixed" ? "Фиксированные цены" : `Скидка ${p.discountPct}%`}
              </div>
              <div>Позиций: {p._count.items}</div>
              <div>Компаний: {p._count.companies}</div>
              {p.minOrderSum && <div>Мин. заказ: {p.minOrderSum}₽</div>}
            </div>
          </Link>
        ))}
        {priceLists.length === 0 && (
          <div className="col-span-full bg-white rounded-xl shadow-sm p-8 text-center text-muted-foreground">
            Прайс-листов нет. Создайте первый.
          </div>
        )}
      </div>
    </div>
  )
}
