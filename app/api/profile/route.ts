import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUserById } from "@/lib/dal/users"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(null, { status: 401 })
  }

  const user = await getUserById(session.user.id)
  if (!user) {
    return NextResponse.json(null, { status: 404 })
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    phone: user.phone,
    defaultAddress: user.defaultAddress,
  })
}
