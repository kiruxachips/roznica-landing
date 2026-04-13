import { Metadata } from "next"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-secondary/20 min-h-screen flex items-start sm:items-center justify-center">
        <div className="w-full max-w-md px-4 py-6 sm:py-0">
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
