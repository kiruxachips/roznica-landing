import { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { getAddressesByUserId } from "@/lib/dal/addresses"
import { AddressList } from "@/components/account/AddressList"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Адресная книга | Millor Coffee",
}

export default async function AddressesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const addresses = await getAddressesByUserId(session.user.id)

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h1 className="text-xl font-serif font-bold">Адресная книга</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Сохраните адреса для быстрого оформления заказов
        </p>
      </div>

      <AddressList addresses={addresses} />
    </div>
  )
}
