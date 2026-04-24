import { redirect } from "next/navigation"
import Link from "next/link"
import { Package, FileText, Building2, Wallet } from "lucide-react"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleOrdersForCompany } from "@/lib/dal/wholesale-orders"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function WholesaleDashboardPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const [company, lastOrders] = await Promise.all([
    prisma.wholesaleCompany.findUnique({
      where: { id: ctx.companyId },
      include: { priceList: { select: { name: true, minOrderSum: true } } },
    }),
    getWholesaleOrdersForCompany(ctx.companyId, { take: 5 }),
  ])

  const creditAvailable = company ? company.creditLimit - company.creditUsed : 0

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">Добро пожаловать, {ctx.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{company?.legalName}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              icon={Package}
              title="Прайс-лист"
              value={company?.priceList?.name ?? "Розничный"}
              sub={company?.priceList?.minOrderSum ? `мин. заказ ${company.priceList.minOrderSum}₽` : null}
            />
            <InfoCard
              icon={FileText}
              title="Условия оплаты"
              value={
                company?.paymentTerms === "prepay"
                  ? "Предоплата"
                  : `Отсрочка ${company?.paymentTerms?.replace("net", "")} дн.`
              }
              sub={null}
            />
            <InfoCard
              icon={Wallet}
              title="Свободный кредит"
              value={company?.paymentTerms !== "prepay" ? `${creditAvailable.toLocaleString("ru")}₽` : "—"}
              sub={company?.paymentTerms !== "prepay" ? `из ${company?.creditLimit.toLocaleString("ru")}₽` : null}
            />
            <InfoCard icon={Building2} title="ИНН" value={company?.inn ?? "—"} sub={null} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Последние заказы</h2>
              <Link href="/wholesale/orders" className="text-sm text-primary hover:underline">
                Все заказы →
              </Link>
            </div>
            {lastOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Заказов пока нет.{" "}
                <Link href="/wholesale/catalog" className="text-primary hover:underline">
                  Перейти в каталог
                </Link>
              </p>
            ) : (
              <div className="divide-y">
                {lastOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/wholesale/orders/${o.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">{o.orderNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("ru")} ·{" "}
                        {o.status}
                        {o.approvalStatus === "pending_approval" && " · ждёт одобрения"}
                      </div>
                    </div>
                    <div className="font-semibold text-sm">{o.total.toLocaleString("ru")}₽</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  value,
  sub,
}: {
  icon: typeof Package
  title: string
  value: string
  sub: string | null
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="font-semibold text-lg">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
