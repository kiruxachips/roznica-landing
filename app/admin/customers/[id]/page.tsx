import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { getCustomerById } from "@/lib/dal/customers"
import { BonusAdjustForm } from "@/components/admin/customers/BonusAdjustForm"
import { can } from "@/lib/permissions"

export const dynamic = "force-dynamic"

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await requireAdmin("customers.view")
  const canEdit = can(admin.role, "customers.edit")
  const { id } = await params
  const data = await getCustomerById(id)
  if (!data) notFound()
  const { user, totalSpent } = data

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div>
        <Link
          href="/admin/customers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Все клиенты
        </Link>
        <h1 className="text-2xl font-bold mt-1">
          {user.name || "Без имени"}
          {user.deletedAt && (
            <span className="ml-3 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded uppercase font-semibold align-middle">
              удалён {new Date(user.deletedAt).toLocaleDateString("ru-RU")}
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.email || "без email"} · {user.phone || "без телефона"}
        </p>
      </div>

      {/* KPI */}
      <div className="grid md:grid-cols-4 gap-4">
        <Kpi label="Заказов" value={user.orders.length.toString()} />
        <Kpi label="LTV" value={`${totalSpent.toLocaleString("ru")}₽`} />
        <Kpi
          label="Бонусы"
          value={`${user.bonusBalance} ₽`}
          hint={user.bonusBalance > 500 ? "Накопил много — можно отправить промо?" : undefined}
        />
        <Kpi
          label="Зарегистрирован"
          value={new Date(user.createdAt).toLocaleDateString("ru-RU")}
          hint={
            user.firstOrderCompletedAt
              ? `Первый заказ: ${new Date(user.firstOrderCompletedAt).toLocaleDateString("ru-RU")}`
              : "Пока без покупок"
          }
        />
      </div>

      {/* Бонусы */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Бонусный баланс</h2>
          <span className="text-lg font-bold text-emerald-700">
            {user.bonusBalance}₽
          </span>
        </div>

        {!user.deletedAt && canEdit && (
          <BonusAdjustForm userId={user.id} currentBalance={user.bonusBalance} />
        )}
        {!user.deletedAt && !canEdit && (
          <p className="text-xs text-muted-foreground italic">
            Ручная выдача бонусов доступна только администраторам.
          </p>
        )}

        {user.bonusTransactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold mb-2">История операций</h3>
            <ul className="divide-y text-sm">
              {user.bonusTransactions.map((t) => (
                <li key={t.id} className="py-2 flex justify-between">
                  <div>
                    <div>{t.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.type} · {new Date(t.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      t.amount > 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {t.amount > 0 ? "+" : ""}
                    {t.amount}₽
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Заказы */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Последние заказы ({user.orders.length})</h2>
        {user.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Клиент не делал заказов</p>
        ) : (
          <div className="divide-y text-sm">
            {user.orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex justify-between py-2 hover:bg-muted/40 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("ru-RU")} · {o.status}
                    {o.deliveryMethod && ` · ${o.deliveryMethod}`}
                  </div>
                </div>
                <div className="font-semibold">{o.total.toLocaleString("ru")}₽</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Адреса */}
      {user.addresses.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Адреса</h2>
          <ul className="space-y-2 text-sm">
            {user.addresses.map((a) => (
              <li key={a.id} className="py-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.title}</span>
                  {a.isDefault && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-semibold">
                      по умолчанию
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground">{a.fullAddress}</div>
                {(a.recipientName || a.recipientPhone) && (
                  <div className="text-xs text-muted-foreground">
                    Получатель: {a.recipientName || "—"}{" "}
                    {a.recipientPhone && `· ${a.recipientPhone}`}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Согласия — compliance audit */}
      {user.consents.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3">Согласия на ПД (152-ФЗ)</h2>
          <ul className="text-xs text-muted-foreground space-y-1">
            {user.consents.map((c) => (
              <li key={c.id}>
                <span className="font-medium text-foreground">{c.type}</span> v{c.version} ·{" "}
                {c.source} · {new Date(c.acceptedAt).toLocaleString("ru-RU")}
                {c.revokedAt && (
                  <span className="text-red-700">
                    {" "}
                    · отозвано {new Date(c.revokedAt).toLocaleDateString("ru-RU")}
                  </span>
                )}
                {c.ipAddress && ` · IP ${c.ipAddress}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  )
}
