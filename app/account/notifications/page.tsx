import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getUserNotificationPrefs } from "@/lib/dal/notifications"
import { NotificationPrefsForm } from "@/components/account/NotificationPrefsForm"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Уведомления | Millor Coffee",
}

export default async function NotificationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const prefs = await getUserNotificationPrefs(session.user.id)
  if (!prefs) redirect("/auth/login")

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h1 className="text-xl font-serif font-bold">Уведомления</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Настройте, какие email-уведомления вы хотите получать
        </p>
      </div>

      <NotificationPrefsForm initial={prefs} />
    </div>
  )
}
