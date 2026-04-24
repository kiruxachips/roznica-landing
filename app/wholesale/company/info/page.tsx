import { redirect } from "next/navigation"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { prisma } from "@/lib/prisma"
import { CompanyInfoForm } from "@/components/wholesale/CompanyInfoForm"

export const dynamic = "force-dynamic"

export default async function WholesaleCompanyInfoPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
  })
  if (!company) redirect("/wholesale/login")

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 max-w-3xl space-y-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">Данные компании</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Заполните юр.реквизиты один раз — они будут использоваться во всех счетах и документах.
              Начните с ИНН — остальное подтянется автоматически из открытых реестров.
            </p>
          </div>
          <CompanyInfoForm
            company={{
              legalName: company.legalName.startsWith("Новый оптовый клиент")
                ? ""
                : company.legalName,
              inn: company.inn.startsWith("TMP") ? "" : company.inn,
              kpp: company.kpp ?? "",
              ogrn: company.ogrn ?? "",
              legalAddress: company.legalAddress ?? "",
              bankName: company.bankName ?? "",
              bankAccount: company.bankAccount ?? "",
              bankBic: company.bankBic ?? "",
              corrAccount: company.corrAccount ?? "",
              status: company.status,
            }}
          />
        </div>
      </div>
    </div>
  )
}
