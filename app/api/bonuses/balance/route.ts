import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBonusBalance } from "@/lib/dal/bonuses"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ balance: 0 })
  }

  const balance = await getBonusBalance(session.user.id)
  return NextResponse.json({ balance })
}
