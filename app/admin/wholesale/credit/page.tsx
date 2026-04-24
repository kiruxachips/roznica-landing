import { redirect } from "next/navigation"

// Раздел «Лимиты отсрочки» упразднён — вся работа идёт по счёту.
// Оставляю редирект чтобы старые ссылки не 404'или.
export default function RemovedCreditPage() {
  redirect("/admin/wholesale/orders")
}
