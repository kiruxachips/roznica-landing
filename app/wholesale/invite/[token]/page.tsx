import { notFound } from "next/navigation"
import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { InviteAcceptForm } from "@/components/wholesale/InviteAcceptForm"

export const metadata: Metadata = {
  title: "Активация приглашения | Оптовый кабинет",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function WholesaleInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const inv = await prisma.wholesaleInvitation.findUnique({
    where: { token },
    include: { company: { select: { legalName: true, status: true } } },
  })

  if (!inv) notFound()

  const expired = inv.expiresAt < new Date()
  const used = inv.usedAt !== null
  const companyInactive = inv.company.status !== "active"

  return (
    <div className="container mx-auto px-4 max-w-md">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-bold mb-2">Приглашение</h1>
        <p className="text-sm text-muted-foreground mb-5">
          В оптовый кабинет компании <strong>{inv.company.legalName}</strong> для{" "}
          {inv.email}
        </p>
        {expired && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            Срок приглашения истёк. Попросите владельца выслать новое.
          </div>
        )}
        {!expired && used && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
            Это приглашение уже использовано.
          </div>
        )}
        {!expired && !used && companyInactive && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
            Кабинет компании сейчас не активен. Свяжитесь с менеджером.
          </div>
        )}
        {!expired && !used && !companyInactive && (
          <InviteAcceptForm token={token} email={inv.email} />
        )}
      </div>
    </div>
  )
}
