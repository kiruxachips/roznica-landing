import { auth } from "@/lib/auth"
import { HeaderClient } from "@/components/layout/HeaderClient"

export async function Header() {
  const session = await auth()
  const sessionUser = session?.user as Record<string, unknown> | undefined
  const user = sessionUser
    ? {
        name: (sessionUser.name as string | null | undefined) ?? null,
        email: (sessionUser.email as string | null | undefined) ?? null,
        userType: (sessionUser.userType as string | null | undefined) ?? null,
      }
    : null

  return <HeaderClient user={user} />
}
