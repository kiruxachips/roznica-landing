import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { checkFavoritesByProductIds } from "@/lib/dal/favorites"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ favorited: [] })
    }

    const productIds = req.nextUrl.searchParams.get("productIds")
    if (!productIds) {
      return NextResponse.json({ favorited: [] })
    }

    const ids = productIds.split(",").filter(Boolean)
    const favSet = await checkFavoritesByProductIds(session.user.id, ids)

    return NextResponse.json({ favorited: Array.from(favSet) })
  } catch (e) {
    console.error("Favorites check error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
