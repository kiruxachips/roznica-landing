export const dynamic = "force-dynamic"

import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-secondary/20">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
