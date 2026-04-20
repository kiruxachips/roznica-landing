export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { SessionProvider } from "@/components/providers/SessionProvider"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen bg-secondary/20">
        <AdminSidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </SessionProvider>
  )
}
