import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShoppingBag, User, Heart, MapPin, Gift, Bell } from "lucide-react"
import { auth } from "@/lib/auth"
import { getUserById } from "@/lib/dal/users"
import { getOrdersByUserId } from "@/lib/dal/orders"
import { getFavoritesCount } from "@/lib/dal/favorites"
import { getAddressCount } from "@/lib/dal/addresses"
import { getBonusBalance } from "@/lib/dal/bonuses"
import { OrderCard } from "@/components/account/OrderCard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Личный кабинет | Millor Coffee",
}

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const [user, ordersData, favCount, addressCount, bonusBalance] = await Promise.all([
    getUserById(session.user.id),
    getOrdersByUserId(session.user.id, { limit: 3 }),
    getFavoritesCount(session.user.id),
    getAddressCount(session.user.id),
    getBonusBalance(session.user.id),
  ])

  if (!user) redirect("/auth/login")

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h1 className="text-2xl font-serif font-bold mb-1">
          {user.name ? `Привет, ${user.name}!` : "Личный кабинет"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {ordersData.total > 0
            ? `У вас ${ordersData.total} ${ordersData.total === 1 ? "заказ" : ordersData.total < 5 ? "заказа" : "заказов"}`
            : "Добро пожаловать в ваш аккаунт"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/account/profile"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Профиль</p>
            <p className="text-xs text-muted-foreground">Личные данные и настройки</p>
          </div>
        </Link>
        <Link
          href="/account/orders"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Мои заказы</p>
            <p className="text-xs text-muted-foreground">{ordersData.total} заказов</p>
          </div>
        </Link>
        <Link
          href="/account/favorites"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="font-medium text-sm">Избранное</p>
            <p className="text-xs text-muted-foreground">{favCount} товаров</p>
          </div>
        </Link>
        <Link
          href="/account/addresses"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium text-sm">Адреса</p>
            <p className="text-xs text-muted-foreground">{addressCount} адресов</p>
          </div>
        </Link>
        <Link
          href="/account/bonuses"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
            <Gift className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="font-medium text-sm">Бонусы</p>
            <p className="text-xs text-muted-foreground">{bonusBalance}₽</p>
          </div>
        </Link>
        <Link
          href="/account/notifications"
          className="bg-white rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="font-medium text-sm">Уведомления</p>
            <p className="text-xs text-muted-foreground">Email-рассылки</p>
          </div>
        </Link>
      </div>

      {ordersData.orders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Последние заказы</h2>
            <Link href="/account/orders" className="text-sm text-primary hover:underline">
              Все заказы
            </Link>
          </div>
          <div className="space-y-3">
            {ordersData.orders.map((order) => (
              <OrderCard
                key={order.id}
                id={order.id}
                orderNumber={order.orderNumber}
                status={order.status}
                total={order.total}
                itemCount={order._count.items}
                createdAt={order.createdAt}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
