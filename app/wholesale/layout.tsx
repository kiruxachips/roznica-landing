import { Metadata } from "next"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { WholesaleHeader } from "@/components/wholesale/Header"

export const metadata: Metadata = {
  title: "Оптовый кабинет — Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WholesaleHeader />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-secondary/10 min-h-screen">
        {children}
      </main>
    </SessionProvider>
  )
}
