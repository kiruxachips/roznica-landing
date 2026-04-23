import { requireAdmin } from "@/lib/admin-guard"
import { listGiftsForAdmin } from "@/lib/dal/gifts"
import { GiftsManager } from "@/components/admin/GiftsManager"

export const dynamic = "force-dynamic"

export default async function AdminGiftsPage() {
  await requireAdmin("gifts.view")
  const gifts = await listGiftsForAdmin()

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-sans text-2xl font-bold mb-2">Подарки</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Пул подарков для заказов от определённой суммы. Клиент на checkout
        выбирает один из активных подарков, чей <strong>минимальный порог</strong>
        {" "}≤ сумме его корзины (после скидки). Если у подарка задан запас, он
        декрементится при оформлении.
      </p>
      <GiftsManager gifts={gifts} />
    </div>
  )
}
