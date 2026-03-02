import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAddressesByUserId } from "@/lib/dal/addresses"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ addresses: [] })
  }

  const addresses = await getAddressesByUserId(session.user.id)
  return NextResponse.json({ addresses })
}
