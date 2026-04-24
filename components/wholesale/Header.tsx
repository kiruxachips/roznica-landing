import Link from "next/link"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { prisma } from "@/lib/prisma"

export async function WholesaleHeader() {
  const ctx = await getWholesaleContext()
  const company = ctx
    ? await prisma.wholesaleCompany.findUnique({
        where: { id: ctx.companyId },
        select: { legalName: true, creditLimit: true, creditUsed: true, paymentTerms: true },
      })
    : null

  const creditAvailable = company ? company.creditLimit - company.creditUsed : 0
  const showCredit = company && company.paymentTerms !== "prepay" && company.creditLimit > 0

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
        <Link href="/wholesale" className="flex items-center gap-2">
          <span className="font-serif text-xl sm:text-2xl font-bold text-primary">Millor Opt</span>
          <span className="hidden sm:inline-block text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
            оптовый кабинет
          </span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          {company && (
            <>
              <span className="hidden sm:inline text-muted-foreground truncate max-w-[240px]">
                {company.legalName}
              </span>
              {showCredit && (
                <span
                  title="Максимальная сумма неоплаченных заказов по отсрочке. Оплачиваете прошлые — лимит высвобождается."
                  className={`hidden md:inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    creditAvailable > 0
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  Лимит отсрочки: {creditAvailable.toLocaleString("ru")}₽ из {company.creditLimit.toLocaleString("ru")}₽
                </span>
              )}
            </>
          )}
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            на розничный сайт
          </Link>
        </div>
      </div>
    </header>
  )
}
