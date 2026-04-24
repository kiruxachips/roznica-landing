import { Metadata } from "next"
import Link from "next/link"
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

      <div className="mt-8 pt-6 border-t border-border">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Опасная зона</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/account/export-data"
            className="text-sm px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors text-center"
          >
            Скачать мои данные
          </Link>
          <Link
            href="/account/delete"
            className="text-sm px-4 py-2 border border-red-200 text-red-700 rounded-xl hover:bg-red-50 transition-colors text-center"
          >
            Удалить аккаунт
          </Link>
        </div>
      </div>
    </div>
  )
}
