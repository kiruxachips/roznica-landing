import { redirect } from "next/navigation"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { prisma } from "@/lib/prisma"
import { TeamManagement } from "@/components/wholesale/TeamManagement"

export const dynamic = "force-dynamic"

export default async function WholesaleTeamPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const me = await prisma.wholesaleUser.findUnique({
    where: { id: ctx.userId },
    select: { role: true },
  })
  const isOwner = me?.role === "owner"

  const [users, invitations] = await Promise.all([
    prisma.wholesaleUser.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    }),
    prisma.wholesaleInvitation.findMany({
      where: {
        companyId: ctx.companyId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ])

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-5">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold">Сотрудники</h1>
          <TeamManagement
            isOwner={isOwner}
            users={users}
            invitations={invitations}
            currentUserId={ctx.userId}
          />
        </div>
      </div>
    </div>
  )
}
