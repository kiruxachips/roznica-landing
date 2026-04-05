import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBonusBalance } from "@/lib/dal/bonuses"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ balance: 0 })
    }

    const balance = await getBonusBalance(session.user.id)
    return NextResponse.json({ balance })
  } catch (e) {
    console.error("Bonuses balance fetch error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
