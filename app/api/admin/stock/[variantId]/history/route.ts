import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getStockHistory } from "@/lib/dal/stock"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const session = await auth()
  const userType = (session?.user as { userType?: string } | undefined)?.userType
  if (!session?.user?.id || userType !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { variantId } = await params
  const history = await getStockHistory(variantId, 100)
  return NextResponse.json(history)
}
