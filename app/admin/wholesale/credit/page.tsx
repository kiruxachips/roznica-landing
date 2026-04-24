import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { listWholesaleCompanies } from "@/lib/dal/wholesale-companies"

export const dynamic = "force-dynamic"

export default async function AdminWholesaleCreditPage() {
  await requireAdmin("wholesale.credit.view")
  const companies = await listWholesaleCompanies({ status: "active" })
  const withCredit = companies.filter((c) => c.creditLimit > 0)

  const totalLimit = withCredit.reduce((s, c) => s + c.creditLimit, 0)
  const totalUsed = withCredit.reduce((s, c) => s + c.creditUsed, 0)
  const totalAvailable = totalLimit - totalUsed

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Кредитные лимиты</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Общий лимит" value={`${totalLimit.toLocaleString("ru")}₽`} />
        <Stat label="Использовано" value={`${totalUsed.toLocaleString("ru")}₽`} />
        <Stat label="Свободно" value={`${totalAvailable.toLocaleString("ru")}₽`} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Компания</th>
              <th className="px-4 py-3 text-left">Условия</th>
              <th className="px-4 py-3 text-right">Лимит</th>
              <th className="px-4 py-3 text-right">Использовано</th>
              <th className="px-4 py-3 text-right">Свободно</th>
              <th className="px-4 py-3 text-right">%</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {withCredit.map((c) => {
              const available = c.creditLimit - c.creditUsed
              const pctUsed = c.creditLimit > 0 ? Math.round((c.creditUsed / c.creditLimit) * 100) : 0
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.legalName}</div>
                    <div className="text-xs text-muted-foreground">ИНН {c.inn}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.paymentTerms}</td>
                  <td className="px-4 py-3 text-right">{c.creditLimit.toLocaleString("ru")}₽</td>
                  <td className="px-4 py-3 text-right">{c.creditUsed.toLocaleString("ru")}₽</td>
                  <td className={`px-4 py-3 text-right ${available < 0 ? "text-red-600 font-semibold" : ""}`}>
                    {available.toLocaleString("ru")}₽
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${pctUsed >= 80 ? "text-red-600 font-semibold" : ""}`}>
                    {pctUsed}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/wholesale/companies/${c.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {withCredit.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Компаний с кредитными лимитами нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}
