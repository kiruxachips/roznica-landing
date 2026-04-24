import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/admin-guard"
import { getAccessRequestById } from "@/lib/dal/wholesale-requests"
import { prisma } from "@/lib/prisma"
import { ApproveRequestPanel } from "@/components/admin/wholesale/ApproveRequestPanel"

export const dynamic = "force-dynamic"

export default async function AdminWholesaleRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin("wholesale.requests.view")
  const { id } = await params
  const req = await getAccessRequestById(id)
  if (!req) notFound()

  const [priceLists, managers] = await Promise.all([
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

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Заявка #{req.id.slice(0, 8)}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2 text-sm">
          <h2 className="font-semibold mb-2">Юрлицо</h2>
          <Row label="Название" value={req.legalName} />
          <Row label="ИНН" value={req.inn} />
          <Row label="Ожидаемый объём" value={req.expectedVolume || "—"} />
          <Row label="Комментарий" value={req.comment || "—"} />
        </section>

        <section className="bg-white rounded-xl shadow-sm p-5 space-y-2 text-sm">
          <h2 className="font-semibold mb-2">Контакт</h2>
          <Row label="Имя" value={req.contactName} />
          <Row label="Телефон" value={req.contactPhone} />
          <Row label="Email" value={req.contactEmail} />
          <Row label="IP" value={req.ipAddress || "—"} />
          <Row label="Дата" value={new Date(req.createdAt).toLocaleString("ru")} />
        </section>
      </div>

      <div className="mt-6">
        {req.status === "pending" ? (
          <ApproveRequestPanel
            requestId={req.id}
            priceLists={priceLists}
            managers={managers}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm">
              Статус: <strong>{req.status}</strong>
              {req.reviewerNote && (
                <>
                  <br />
                  Комментарий: {req.reviewerNote}
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
