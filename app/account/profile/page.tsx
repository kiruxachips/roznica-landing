import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserById } from "@/lib/dal/users"
import { ProfileForm } from "@/components/account/ProfileForm"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Профиль | Millor Coffee",
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const user = await getUserById(session.user.id)
  if (!user) redirect("/auth/login")

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-sans font-bold mb-5 sm:mb-6">Профиль</h1>
      <ProfileForm
        user={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          defaultAddress: user.defaultAddress,
          avatarUrl: user.avatarUrl ?? user.image ?? null,
          passwordHash: !!user.passwordHash,
          accounts: user.accounts,
        }}
      />
    </div>
  )
}
