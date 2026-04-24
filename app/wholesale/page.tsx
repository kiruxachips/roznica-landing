import { redirect } from "next/navigation"
import Link from "next/link"
import { Package, FileText, Building2, Truck } from "lucide-react"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleOrdersForCompany } from "@/lib/dal/wholesale-orders"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const APPROVAL_LABEL: Record<string, string> = {
  pending_approval: "на рассмотрении",
  approved: "одобрена",
  rejected: "отклонена",
}

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

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-6">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">Добро пожаловать, {ctx.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{company?.legalName}</p>
          </div>

          {(!company?.inn || company.inn.startsWith("TMP")) && (
            <Link
              href="/wholesale/company/info"
              className="block rounded-2xl bg-primary/5 border border-primary/20 p-4 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">📄</div>
                <div>
                  <div className="font-semibold">
                    Заполните реквизиты для корректного счёта
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    ИНН, юр.адрес и банковские реквизиты попадают в платёжку.
                    Без этих данных менеджер свяжется отдельно для уточнения.
                  </div>
                </div>
              </div>
            </Link>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard
              icon={Package}
              title="Прайс-лист"
              value={company?.priceList?.name ?? "—"}
              sub={company?.priceList?.minOrderSum ? `мин. заказ ${company.priceList.minOrderSum}₽` : null}
            />
            <InfoCard
              icon={FileText}
              title="Порядок работы"
              value="Заявка → счёт → оплата"
              sub="100% предоплата по платёжке"
            />
            <InfoCard
              icon={Truck}
              title="Доставка"
              value="CDEK · Почта России"
              sub="отдельной строкой в счёте"
            />
            <InfoCard icon={Building2} title="ИНН" value={company?.inn && !company.inn.startsWith("TMP") ? company.inn : "—"} sub={null} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Последние заявки</h2>
              <Link href="/wholesale/orders" className="text-sm text-primary hover:underline">
                Все →
              </Link>
            </div>
            {lastOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Заявок пока нет.{" "}
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
                        {new Date(o.createdAt).toLocaleDateString("ru")} · {o.status}
                        {o.approvalStatus && ` · ${APPROVAL_LABEL[o.approvalStatus] ?? o.approvalStatus}`}
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
      <div className="font-semibold text-base">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
