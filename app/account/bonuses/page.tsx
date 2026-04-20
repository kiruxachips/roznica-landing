import { Metadata } from "next"
import { redirect } from "next/navigation"
import { Gift } from "lucide-react"
import { auth } from "@/lib/auth"
import { getBonusBalance, getBonusTransactions } from "@/lib/dal/bonuses"
import { BonusHistory } from "@/components/account/BonusHistory"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Бонусы | Millor Coffee",
}

export default async function BonusesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const [balance, { transactions }] = await Promise.all([
    getBonusBalance(session.user.id),
    getBonusTransactions(session.user.id),
  ])

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-5 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-sans font-bold">Бонусная программа</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Копите бонусы и оплачивайте ими до 50% заказа
        </p>
      </div>

      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 sm:p-6 mb-5 sm:mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ваш баланс</p>
            <p className="text-2xl font-bold text-primary">{balance}₽</p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          <p>1 бонус = 1₽ при оплате заказа</p>
          <p>5% от суммы заказа начисляется при доставке</p>
          <p>Можно списать до 50% стоимости заказа</p>
        </div>
      </div>

      <h2 className="font-semibold text-sm mb-3">История операций</h2>
      <BonusHistory transactions={transactions} />
    </div>
  )
}
