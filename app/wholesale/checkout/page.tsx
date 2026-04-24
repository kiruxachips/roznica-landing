import { redirect } from "next/navigation"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { WholesaleCheckout } from "@/components/wholesale/CheckoutForm"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function WholesaleCheckoutPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
    select: {
      legalName: true,
      inn: true,
      kpp: true,
      postalAddress: true,
      contactName: true,
      contactPhone: true,
    },
  })

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-5">Оформление</h1>
          <WholesaleCheckout
            defaultAddress={company?.postalAddress ?? ""}
            defaultPhone={company?.contactPhone ?? ""}
            defaultName={company?.contactName ?? ctx.name}
            companyLegalName={company?.legalName ?? ""}
            companyInn={company?.inn ?? ""}
            companyKpp={company?.kpp ?? null}
          />
        </div>
      </div>
    </div>
  )
}
