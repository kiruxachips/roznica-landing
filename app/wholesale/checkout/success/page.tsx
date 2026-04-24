import { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"

export const metadata: Metadata = {
  title: "Заказ принят | Оптовый кабинет",
  robots: { index: false, follow: false },
}

export default async function WholesaleCheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order } = await searchParams

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center max-w-lg mx-auto">
            <div className="inline-flex mx-auto mb-4 p-3 rounded-full bg-green-50 text-green-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Заказ принят</h1>
            {order && (
              <p className="text-muted-foreground mb-4">
                Номер заказа: <strong className="text-foreground">{order}</strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-6">
              Мы отправили подтверждение на почту. Ответственный менеджер свяжется с вами для
              подтверждения деталей и оплаты.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/wholesale/orders"
                className="rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors"
              >
                Мои заказы
              </Link>
              <Link
                href="/wholesale/catalog"
                className="rounded-xl border border-border font-medium px-6 py-2.5 hover:bg-muted transition-colors"
              >
                В каталог
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
