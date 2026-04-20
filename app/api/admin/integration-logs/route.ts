import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth()
  const userType = (session?.user as { userType?: string } | undefined)?.userType
  if (!session?.user?.id || userType !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const source = url.searchParams.get("source")
  const onlyErrors = url.searchParams.get("errors") === "1"

  const where: { source?: string; OR?: object[] } = {}
  if (source && source !== "all") where.source = source
  if (onlyErrors) {
    where.OR = [{ error: { not: null } }, { statusCode: { gte: 400 } }]
  }

  const logs = await prisma.integrationLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json(logs)
}
