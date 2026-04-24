import { redirect } from "next/navigation"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function WholesaleCompanyPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
    include: { priceList: { select: { name: true } } },
  })
  if (!company) redirect("/wholesale/login")

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-5">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Профиль компании</h1>

          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold mb-3">Реквизиты</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Наименование" value={company.legalName} />
              <Field label="ИНН" value={company.inn} />
              {company.kpp && <Field label="КПП" value={company.kpp} />}
              {company.ogrn && <Field label="ОГРН" value={company.ogrn} />}
              {company.legalAddress && (
                <div className="sm:col-span-2">
                  <Field label="Юридический адрес" value={company.legalAddress} />
                </div>
              )}
              {company.postalAddress && (
                <div className="sm:col-span-2">
                  <Field label="Почтовый адрес" value={company.postalAddress} />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Для изменения реквизитов свяжитесь с менеджером.
            </p>
          </section>

          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold mb-3">Условия работы</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field
                label="Прайс-лист"
                value={company.priceList?.name ?? "Розничный (не назначен оптовый)"}
              />
              <Field
                label="Условия оплаты"
                value={
                  company.paymentTerms === "prepay"
                    ? "Предоплата"
                    : `Отсрочка ${company.paymentTerms.replace("net", "")} дн.`
                }
              />
              {company.paymentTerms !== "prepay" && (
                <>
                  <Field label="Лимит отсрочки платежа" value={`${company.creditLimit.toLocaleString("ru")}₽`} />
                  <Field
                    label="Использовано"
                    value={`${company.creditUsed.toLocaleString("ru")}₽`}
                  />
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold mb-3">Контакт</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Имя" value={company.contactName} />
              <Field label="Телефон" value={company.contactPhone} />
              <Field label="Email" value={company.contactEmail} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-medium break-words">{value || "—"}</div>
    </div>
  )
}
