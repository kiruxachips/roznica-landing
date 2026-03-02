import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16 bg-secondary/20 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          {children}
        </div>
      </main>
      <Footer />
    </>
  )
}
