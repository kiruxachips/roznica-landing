import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { getWholesaleCompanyById } from "@/lib/dal/wholesale-companies"
import { prisma } from "@/lib/prisma"
import { CompanyEditPanel } from "@/components/admin/wholesale/CompanyEditPanel"

export const dynamic = "force-dynamic"

export default async function AdminWholesaleCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin("wholesale.companies.view")
  const { id } = await params
  const [company, priceLists, managers] = await Promise.all([
    getWholesaleCompanyById(id),
    prisma.priceList.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.adminUser.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])
  if (!company) notFound()

  const available = company.creditLimit - company.creditUsed

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/wholesale/companies" className="text-sm text-muted-foreground hover:text-foreground">
            ← Все компании
          </Link>
          <h1 className="text-2xl font-bold mt-1">{company.legalName}</h1>
          <p className="text-sm text-muted-foreground">
            ИНН {company.inn} · {company.status} · {company.paymentTerms}
          </p>
        </div>
      </div>

      <CompanyEditPanel company={company} priceLists={priceLists} managers={managers} />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-xs text-muted-foreground">Кредитный лимит</div>
          <div className="text-xl font-semibold mt-1">
            {company.creditLimit.toLocaleString("ru")}₽
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-xs text-muted-foreground">Использовано</div>
          <div className="text-xl font-semibold mt-1">
            {company.creditUsed.toLocaleString("ru")}₽
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="text-xs text-muted-foreground">Доступно</div>
          <div className={`text-xl font-semibold mt-1 ${available < 0 ? "text-red-600" : ""}`}>
            {available.toLocaleString("ru")}₽
          </div>
        </div>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Сотрудники ({company.users.length})</h2>
        <ul className="divide-y text-sm">
          {company.users.map((u) => (
            <li key={u.id} className="py-2 flex justify-between">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">
                  {u.email} · {u.role} · {u.status}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {u.lastLoginAt ? `последний вход: ${new Date(u.lastLoginAt).toLocaleString("ru")}` : "ни разу"}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Последние заказы</h2>
          <Link
            href={`/admin/wholesale/orders?companyId=${company.id}`}
            className="text-sm text-primary hover:underline"
          >
            Все →
          </Link>
        </div>
        {company.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Заказов нет</p>
        ) : (
          <div className="divide-y text-sm">
            {company.orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex justify-between py-2 hover:bg-muted/40 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="font-medium">{o.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleString("ru")} · {o.status}
                    {o.approvalStatus === "pending_approval" && " · ждёт одобрения"}
                  </div>
                </div>
                <div className="font-semibold">{o.total.toLocaleString("ru")}₽</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">История кредита</h2>
        {company.creditTx.length === 0 ? (
          <p className="text-sm text-muted-foreground">Операций нет</p>
        ) : (
          <div className="divide-y text-sm">
            {company.creditTx.map((t) => (
              <div key={t.id} className="py-2 flex justify-between">
                <div>
                  <div className="font-medium">{t.type}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("ru")}
                    {t.description && ` · ${t.description}`}
                  </div>
                </div>
                <div className={`font-semibold ${t.amount > 0 ? "text-red-600" : "text-green-600"}`}>
                  {t.amount > 0 ? "+" : ""}
                  {t.amount.toLocaleString("ru")}₽
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {company.notes && (
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-2">Заметки менеджера (CRM)</h2>
          <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
        </section>
      )}
    </div>
  )
}
