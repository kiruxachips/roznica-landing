import { Metadata } from "next"
import { redirect } from "next/navigation"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { WholesaleCart } from "@/components/wholesale/Cart"

export const metadata: Metadata = {
  title: "Корзина | Оптовый кабинет",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function WholesaleCartPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-5">Корзина</h1>
          <WholesaleCart />
        </div>
      </div>
    </div>
  )
}
